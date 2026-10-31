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

    def ensure_participant_authorized(self, account_address: str):
        if not self.contract:
            return
        target = Web3.to_checksum_address(account_address)
        try:
            is_auth = self.contract.functions.authorizedParticipants(target).call()
            if not is_auth:
                owner_key = Config.HARDHAT_OWNER_PRIVATE_KEY
                owner_acct = self.web3.eth.account.from_key(owner_key)
                func = self.contract.functions.authorizeParticipant(target)
                self._send_transaction(func, owner_acct)
                logger.info(f"Authorized participant on blockchain: {target}")
        except Exception as e:
            logger.warning(f"Could not authorize participant {account_address}: {e}")

    def transfer_batch(
        self,
        sender_private_key: str,
        batch_id: str,
        receiver_address: str,
        new_seal_id: str,
    ) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        receiver = Web3.to_checksum_address(receiver_address)
        account = self.web3.eth.account.from_key(sender_private_key)
        self.ensure_participant_authorized(account.address)
        self.ensure_participant_authorized(receiver)
        func = self.contract.functions.transferBatch(
            str(batch_id), receiver, str(new_seal_id)
        )
        return self._send_transaction(func, account)

    def inspect_batch(
        self,
        inspector_private_key: str,
        batch_id: str,
        notes: str,
        new_seal_id: str,
    ) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        account = self.web3.eth.account.from_key(inspector_private_key)
        self.ensure_participant_authorized(account.address)

        func = self.contract.functions.inspectBatch(
            str(batch_id), str(notes), str(new_seal_id)
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

    def _sync_batch_from_db(self, batch_id: str) -> bool:
        """If batch exists in MongoDB but Hardhat node was restarted, re-registers & synchronizes batch on-chain."""
        try:
            from database import batches_col
            from config import Config
            import datetime

            batch = batches_col.find_one({"$or": [{"batchId": batch_id}, {"batchNumber": batch_id}, {"_id": batch_id}]})
            if not batch:
                return False

            b_id = batch.get("batchId", batch_id)
            med_name = batch.get("medicineName", "Medicine")
            batch_num = batch.get("batchNumber", b_id)
            exp_date_str = batch.get("expiryDate", "12/2030")

            # Calculate expiry timestamp in future
            exp_ts = int((datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=730)).timestamp())
            if "/" in str(exp_date_str):
                parts = str(exp_date_str).split("/")
                if len(parts) == 2:
                    try:
                        m, y = int(parts[0]), int(parts[1])
                        exp_ts = int(datetime.datetime(y, m, 28, tzinfo=datetime.timezone.utc).timestamp())
                    except Exception:
                        pass

            qty = int(batch.get("quantity") or 1000)
            transfers = batch.get("transferHistory", [])
            initial_seal = batch.get("sealId", "SEAL-001")
            if transfers and transfers[0].get("previousSealId"):
                initial_seal = transfers[0].get("previousSealId")

            logger.info(f"Auto-syncing batch '{b_id}' to active blockchain ledger...")
            mfg_key = Config.HARDHAT_OWNER_PRIVATE_KEY
            self.register_batch(
                sender_private_key=mfg_key,
                batch_id=b_id,
                medicine_name=med_name,
                batch_number=batch_num,
                expiry_timestamp=exp_ts,
                quantity=qty,
                seal_id=initial_seal,
            )

            stage_eth_accounts = {
                "Manufacturer": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                "Distributor": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                "Wholesaler": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                "Retailer": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            }
            stage_eth_keys = {
                "Manufacturer": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
                "Distributor": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
                "Wholesaler": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
                "Retailer": "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
            }

            if transfers:
                for t in transfers:
                    sender_stage = t.get("senderStage", "Manufacturer")
                    receiver_stage = t.get("receiverStage", "Distributor")
                    receiver_addr = stage_eth_accounts.get(receiver_stage, "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
                    new_seal = t.get("newSealId", "SEAL-TRANS")
                    s_key = stage_eth_keys.get(sender_stage, mfg_key)
                    self.transfer_batch(
                        sender_private_key=s_key,
                        batch_id=b_id,
                        receiver_address=receiver_addr,
                        new_seal_id=new_seal,
                    )
            elif batch.get("stage") == "Distributor" or batch.get("status") == "In Transit":
                dist_addr = stage_eth_accounts.get("Distributor")
                new_seal = batch.get("sealId", "SEAL-TR-9001")
                self.transfer_batch(
                    sender_private_key=mfg_key,
                    batch_id=b_id,
                    receiver_address=dist_addr,
                    new_seal_id=new_seal,
                )

            receipts = batch.get("receiptHistory", [])
            for r in receipts:
                insp_stage = r.get("receivedByStage", "Distributor")
                insp_key = stage_eth_keys.get(insp_stage, mfg_key)
                notes = f"Receipt & Baseline Verified at {insp_stage}"
                curr_seal = batch.get("sealId", "SEAL-INSPECTED")
                try:
                    self.inspect_batch(
                        inspector_private_key=insp_key,
                        batch_id=b_id,
                        notes=notes,
                        new_seal_id=curr_seal,
                    )
                except Exception as ie:
                    logger.warning(f"Could not replay inspection during sync: {ie}")

            dispenses = batch.get("dispenseHistory", [])
            for d in dispenses:
                ret_key = stage_eth_keys.get("Retailer", mfg_key)
                disp_notes = f"Dispensed {d.get('dispensedQuantity')} units to patient: {d.get('patientId')}"
                curr_seal = batch.get("sealId", "SEAL-DISPENSED")
                try:
                    self.inspect_batch(
                        inspector_private_key=ret_key,
                        batch_id=b_id,
                        notes=disp_notes,
                        new_seal_id=curr_seal,
                    )
                except Exception as de:
                    logger.warning(f"Could not replay dispense during sync: {de}")

            logger.info(f"Successfully auto-synced batch '{b_id}' to active blockchain ledger!")
            return True
        except Exception as e:
            logger.error(f"Error auto-syncing batch '{batch_id}' to blockchain: {e}")
            return False

    def get_batch_history(self, batch_id: str) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        try:
            batch, holder, transfers, inspections = (
                self.contract.functions.getBatchHistory(batch_id).call()
            )
        except Exception as e:
            # Try to auto-sync from MongoDB if Hardhat node was restarted
            if self._sync_batch_from_db(batch_id):
                batch, holder, transfers, inspections = (
                    self.contract.functions.getBatchHistory(batch_id).call()
                )
            else:
                raise e

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

    def get_batch_events(self, batch_id: str) -> dict:
        if not self.contract:
            raise RuntimeError("Blockchain contract is not initialized.")

        try:
            history = self.get_batch_history(batch_id)
        except Exception as e:
            logger.warning(f"Batch '{batch_id}' not found on blockchain: {e}")
            return {
                "batchId": batch_id,
                "contractAddress": self.contract_address,
                "currentHolder": "Not registered on active ledger",
                "onChainHistory": None,
                "events": [],
                "recordedEvents": [],
                "eventCount": 0,
                "warning": f"Batch '{batch_id}' has not been registered on the current blockchain instance."
            }

        events = []

        def clean_val(val):
            if isinstance(val, (bytes, bytearray)):
                return "0x" + val.hex()
            return val

        try:
            reg_filter = self.contract.events.BatchRegistered.create_filter(
                from_block=0,
                argument_filters={"batchId": batch_id}
            )
            for entry in reg_filter.get_all_entries():
                raw_args = dict(entry.args)
                clean_args = {k: clean_val(v) for k, v in raw_args.items()}
                clean_args["batchId"] = batch_id
                events.append({
                    "event": "BatchRegistered",
                    "blockNumber": entry.blockNumber,
                    "transactionHash": entry.transactionHash.hex(),
                    "args": clean_args
                })
        except Exception as e:
            logger.warning(f"Could not query BatchRegistered events: {e}")

        try:
            trans_filter = self.contract.events.BatchTransferred.create_filter(
                from_block=0,
                argument_filters={"batchId": batch_id}
            )
            for entry in trans_filter.get_all_entries():
                raw_args = dict(entry.args)
                clean_args = {k: clean_val(v) for k, v in raw_args.items()}
                clean_args["batchId"] = batch_id
                events.append({
                    "event": "BatchTransferred",
                    "blockNumber": entry.blockNumber,
                    "transactionHash": entry.transactionHash.hex(),
                    "args": clean_args
                })
        except Exception as e:
            logger.warning(f"Could not query BatchTransferred events: {e}")

        try:
            inspect_filter = self.contract.events.BatchInspected.create_filter(
                from_block=0,
                argument_filters={"batchId": batch_id}
            )
            for entry in inspect_filter.get_all_entries():
                raw_args = dict(entry.args)
                clean_args = {k: clean_val(v) for k, v in raw_args.items()}
                clean_args["batchId"] = batch_id
                events.append({
                    "event": "BatchInspected",
                    "blockNumber": entry.blockNumber,
                    "transactionHash": entry.transactionHash.hex(),
                    "args": clean_args
                })
        except Exception as e:
            logger.warning(f"Could not query BatchInspected events: {e}")

        current_holder = history.get("currentHolder", "")

        return {
            "batchId": batch_id,
            "contractAddress": self.contract_address,
            "currentHolder": current_holder,
            "onChainHistory": history,
            "events": events,
            "recordedEvents": events,
            "eventCount": len(events),
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
