// Deploys a contract wasm to Stellar TESTNET with a throwaway account funded by
// Friendbot, and prints the new Contract ID. No secrets in, none stored: the
// account exists only for this run and only holds Testnet play money.
//
//   node scripts/deploy.mjs <path/to/contract.wasm>
//
// In GitHub Actions the id is also written to $GITHUB_OUTPUT as `contract_id`.
import {randomBytes} from 'node:crypto';
import {appendFileSync, readFileSync} from 'node:fs';
import {
	Address,
	Keypair,
	Networks,
	Operation,
	TransactionBuilder,
	hash,
	rpc,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const FRIENDBOT = 'https://friendbot.stellar.org/?addr=';

const wasmPath = process.argv[2];
if (!wasmPath) {
	console.error('usage: node scripts/deploy.mjs <contract.wasm>');
	process.exit(1);
}

const server = new rpc.Server(RPC_URL);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fund(publicKey) {
	for (let attempt = 1; attempt <= 4; attempt++) {
		const response = await fetch(`${FRIENDBOT}${encodeURIComponent(publicKey)}`);
		if (response.ok) return;
		await sleep(2000 * attempt);
	}

	throw new Error('Friendbot did not fund the account');
}

/** Prepares (simulate + footprint + fee), signs, sends and waits for SUCCESS. */
async function submit(operation, keypair) {
	const account = await server.getAccount(keypair.publicKey());
	const built = new TransactionBuilder(account, {
		fee: '1000000',
		networkPassphrase: Networks.TESTNET,
	})
		.addOperation(operation)
		.setTimeout(120)
		.build();
	const prepared = await server.prepareTransaction(built);
	prepared.sign(keypair);
	const sent = await server.sendTransaction(prepared);
	if (sent.status === 'ERROR') {
		throw new Error(`transaction rejected: ${JSON.stringify(sent.errorResult)}`);
	}

	for (let i = 0; i < 40; i++) {
		const result = await server.getTransaction(sent.hash);
		if (result.status === 'SUCCESS') return result;
		if (result.status === 'FAILED') throw new Error(`transaction failed: ${sent.hash}`);
		await sleep(1500);
	}

	throw new Error(`timed out waiting for ${sent.hash}`);
}

const wasm = readFileSync(wasmPath);
const deployer = Keypair.random();
console.error('Funding a throwaway Testnet account with Friendbot...');
await fund(deployer.publicKey());

console.error(`Uploading ${wasmPath} (${wasm.length} bytes)...`);
await submit(Operation.uploadContractWasm({wasm}), deployer);

console.error('Creating the contract instance...');
const created = await submit(
	Operation.createCustomContract({
		address: Address.fromString(deployer.publicKey()),
		wasmHash: hash(wasm),
		salt: randomBytes(32),
	}),
	deployer,
);

const contractId = Address.fromScVal(created.returnValue).toString();
console.log(contractId);
if (process.env.GITHUB_OUTPUT) {
	appendFileSync(process.env.GITHUB_OUTPUT, `contract_id=${contractId}\n`);
}
