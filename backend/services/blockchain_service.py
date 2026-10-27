import json
import logging
import os
from web3 import Web3
from config import Config

logger = logging.getLogger(__name__)


class BlockchainService:
    def __init__(self):
        self.rpc_url = Config.RPC_URL
        self.web3 = Web3(Web3.HTTPProvider(self.rpc_url))
        self.contract_address = Config.CONTRACT_ADDRESS
        self.contract = None
        self.abi = None
        self.bytecode = None

        self._load_artifact()
        self._initialize_contract()

    def _load_artifact(self):
        try:
            artifact_path = Config.ABI_PATH
            if not os.path.exists(artifact_path):
                # Fallback to PharmaShield_abi.json
                fallback = os.path.join(
                    os.path.dirname(os.path.dirname(Config.ABI_PATH)),
                    "PharmaShield_abi.json",
                )
                if os.path.exists(fallback):
                    with open(fallback, "r", encoding="utf-8") as f:
                        self.abi = json.load(f)
                    return

            with open(artifact_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.abi = data.get("abi", [])
                self.bytecode = data.get("bytecode", "")
        except Exception as e:
            logger.error(f"Error loading contract artifact: {e}")

    def _initialize_contract(self):
        if not self.is_connected():
            logger.warning(f"Web3 cannot connect to {self.rpc_url}")
            return

        if not self.abi:
            logger.warning("Contract ABI is not available.")
            return

        try:
            # Check if code exists at contract_address
            checksum_addr = Web3.to_checksum_address(self.contract_address)
            code = self.web3.eth.get_code(checksum_addr)

            if len(code) <= 2 and self.bytecode:
                # No contract deployed at this address, auto-deploy on local node
                logger.info("Contract not found at address. Auto-deploying to local node...")
                self._deploy_contract()
            else:
                self.contract = self.web3.eth.contract(address=checksum_addr, abi=self.abi)
                logger.info(f"Connected to PharmaShield contract at {checksum_addr}")
        except Exception as e:
            logger.warning(f"Could not bind contract at {self.contract_address}: {e}")

    def _deploy_contract(self):
        try:
            owner_key = Config.HARDHAT_OWNER_PRIVATE_KEY
            account = self.web3.eth.account.from_key(owner_key)
            contract_factory = self.web3.eth.contract(abi=self.abi, bytecode=self.bytecode)

            nonce = self.web3.eth.get_transaction_count(account.address)
            tx = contract_factory.constructor().build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 6000000,
                "gasPrice": self.web3.eth.gas_price,
            })

            signed = account.sign_transaction(tx)
            tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

            self.contract_address = receipt.contractAddress
            self.contract = self.web3.eth.contract(
                address=receipt.contractAddress, abi=self.abi
            )
            logger.info(f"PharmaShield successfully deployed to: {receipt.contractAddress}")
        except Exception as e:
            logger.error(f"Failed to auto-deploy contract: {e}")

    def is_connected(self) -> bool:
        try:
            return bool(self.web3 and self.web3.is_connected())
        except Exception:
            return False

    def get_status(self) -> dict:
        connected = self.is_connected()
        status = {
            "connected": connected,
            "rpcUrl": self.rpc_url,
            "chainId": None,
            "contractAddress": self.contract_address,
            "contractLoaded": self.contract is not None,
            "owner": None,
        }

        if connected:
            try:
                status["chainId"] = self.web3.eth.chain_id
                if self.contract:
                    status["owner"] = self.contract.functions.owner().call()
            except Exception as e:
                status["warning"] = str(e)

        return status

    def register_batch(
        self,
        sender_private_key: str,
        batch_id: str,
        medicine_name: str,
        batch_number: str,
        expiry_timestamp: int,
        quantity: int,
        seal_id: str,
    ) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        account = self.web3.eth.account.from_key(sender_private_key)
        func = self.contract.functions.registerBatch(
            str(batch_id),
            str(medicine_name),
            str(batch_number),
            int(expiry_timestamp),
            int(quantity),
            str(seal_id),
        )

        return self._send_transaction(func, account)

    def transfer_batch(
        self,
        sender_private_key: str,
        batch_id: str,
        receiver_address: str,
        new_seal_id: str,
    ) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        account = self.web3.eth.account.from_key(sender_private_key)
        receiver = Web3.to_checksum_address(receiver_address)

        func = self.contract.functions.transferBatch(
            str(batch_id), receiver, str(new_seal_id)
        )
        return self._send_transaction(func, account)

    def get_batch(self, batch_id: str) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        res = self.contract.functions.getBatch(batch_id).call()
        return {
            "batchId": res[0],
            "medicineName": res[1],
            "batchNumber": res[2],
            "expiryDate": res[3],
            "quantity": res[4],
            "sealId": res[5],
        }

    def get_batch_history(self, batch_id: str) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        batch, holder, transfers, inspections = (
            self.contract.functions.getBatchHistory(batch_id).call()
        )

        return {
            "batch": {
                "batchId": batch[0],
                "medicineName": batch[1],
                "batchNumber": batch[2],
                "expiryDate": batch[3],
                "quantity": batch[4],
                "sealId": batch[5],
            },
            "currentHolder": holder,
            "transfers": [
                {
                    "sender": t[0],
                    "receiver": t[1],
                    "quantity": t[2],
                    "timestamp": t[3],
                    "previousSealId": t[4],
                    "newSealId": t[5],
                }
                for t in transfers
            ],
            "inspections": [
                {
                    "inspector": i[0],
                    "timestamp": i[1],
                    "notes": i[2],
                    "previousSealId": i[3],
                    "newSealId": i[4],
                }
                for i in inspections
            ],
        }

    def _send_transaction(self, function, account) -> dict:
        nonce = self.web3.eth.get_transaction_count(account.address)
        tx = function.build_transaction({
            "from": account.address,
            "nonce": nonce,
            "chainId": self.web3.eth.chain_id,
            "gas": 1500000,
            "gasPrice": self.web3.eth.gas_price,
        })

        signed = account.sign_transaction(tx)
        tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status != 1:
            raise RuntimeError(f"Blockchain transaction failed with tx: {tx_hash.hex()}")

        return {
            "transactionHash": tx_hash.hex(),
            "blockNumber": receipt.blockNumber,
            "status": "success",
            "contractAddress": self.contract_address,
        }


blockchain_service = BlockchainService()
