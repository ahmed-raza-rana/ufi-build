let initialSetupComplete = false;

if (typeof ethers === 'undefined') {
    console.error('ethers.js is not loaded.');
} else {
    console.log('ethers.js is loaded successfully.');
}

//BNB Mainnet
var networkConfigMainNet = {
    chainId: '0x38', // Chain ID in hex format for BSC Mainnet
    chainName: 'Binance Smart Chain Mainnet',
    nativeCurrency: {
        symbol: 'BNB', // Currency symbol
        decimals: 18
    },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com']
};

//BNB Testnet
var networkConfigTestNet = {
    chainId: '0x61', // Chain ID in hex format for BSC Testnet
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: {
        symbol: 'tBNB', // Currency symbol
        decimals: 18
    },
    rpcUrls: ['https://data-seed-prebsc-1-s1.bnbchain.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com']
};

async function connectToMetaMask(desiredNetwork)
{
    if (typeof window.ethereum === 'undefined') {
        window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', 'Error! MetaMask is not installed');
        return;
    }
    console.log("HEllo world");
    // Add event listeners for account and network changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    try {
        console.log("Trying");

        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const connectedAddress = accounts[0];
        console.log("Account Requested");
        // Check network
        const networkId = await window.ethereum.request({ method: 'net_version' });
        console.log("Account Requested");
        var targetNetwork = networkConfigMainNet;

        if(desiredNetwork === "97")
        {
            console.log("Network COnfig test set");
            targetNetwork = networkConfigTestNet;
        }
        console.log("Network COnfig set");
        console.log("desired: ",desiredNetwork);
        console.log("netwokr: ",networkId);

        if (networkId !== desiredNetwork) {
            try {
                console.log("Switch Call");
                // Try to switch to the desired network
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [targetNetwork],
                });
                console.log("Switch Call end");
                // Wait for the network to change
                window.ethereum.once('chainChanged', () => {
                    // Verify network again
                    verifyNetwork(desiredNetwork, connectedAddress);
                });
                
                console.log("Verified Network");

            } catch (switchError) {
                // If the network has not been added to MetaMask, prompt the user to add it
                if (switchError.code === 4902) {
                    window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', 'Error! The network BNB Mainnet has not been added to MetaMask. Please add it manually.');
                    return;
                } else {
                    window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', `Error! Failed to switch network to BNB Mainnet. ${switchError.message}`);
                    return;
                }
            }
        } else {
            initialSetupComplete = true; // Mark initial setup as complete
            window.unityIns.SendMessage('LoginManager', 'OnWalletConnected', connectedAddress);
        }
    } catch (error) {
        if (error.code === 4001) {
            // User rejected the request
            window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', 'Error! User rejected the request');
        } else {
            window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', `${error.message}`);
        }
    }
}

function handleAccountsChanged(accounts) {
    if (initialSetupComplete) {
        alert('Connected wallet has been changed. Click OK to reload the page.');
        window.location.reload();
    }
}

function handleChainChanged(chainId) {
    if (initialSetupComplete) {
        alert('Network has been changed. Click OK to reload the page.');
        window.location.reload();
    }
}

function verifyNetwork(desiredNetwork, connectedAddress) {
    console.log("Verified Network called");
    window.ethereum.request({ method: 'net_version' }).then(networkId => {
        if (networkId === desiredNetwork) {
            initialSetupComplete = true; // Mark initial setup as complete
            window.unityIns.SendMessage('LoginManager', 'OnWalletConnected', connectedAddress);
        } else {
            window.unityIns.SendMessage('LoginManager', 'OnWalletFailedToConnect', 'Error! Failed to switch to the BNB Mainnet.');
        }
    });
}

async function initiateTransaction(tokenAddress, toAddress, amount, fromAddress) {
    if (!window.ethereum) {
        console.error('Ethereum object not found');
        window.unityIns.SendMessage('TransactionManager', 'OnTransactionResponse', 'error:Ethereum object not found');
        return;
    }

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner(fromAddress);

    console.log('Initiating transaction with:');
    console.log('Token Address:', tokenAddress);
    console.log('To Address:', toAddress);
    console.log('Amount:', amount);

    try {
        // Convert amount to BigNumber
        const amountInBigNumber = ethers.BigNumber.from(amount);
        console.log('Amount converted to BigNumber:', amountInBigNumber.toString());

        // Define the ERC20 transfer function signature
        const abi = [
            "function transfer(address to, uint256 amount) returns (bool)"
        ];

        // Create a Contract instance
        const contract = new ethers.Contract(tokenAddress, abi, signer);

        // Prepare transaction options with a manual gas limit
        const txOptions = {
            gasLimit: ethers.utils.hexlify(100000) // Set a reasonable gas limit
        };

        // Prepare the transaction
        const txResponse = await contract.transfer(toAddress, amountInBigNumber, txOptions);

        console.log('Transaction Hash:', txResponse.hash);

        // Wait for confirmation
        console.log('Waiting for transaction confirmation...');
        await txResponse.wait();

        console.log('Transaction confirmed!');
        window.unityIns.SendMessage('TransactionManager', 'OnTransactionResponse', `success:${txResponse.hash}`);
    } catch (error) {
        // Enhanced error handling with detailed messages
        console.error('Transaction Error:', error);

        let errorMessage = 'An unknown error occurred.';
        if (error.message.includes('user rejected')) {
            errorMessage = 'The transaction was rejected by the user.';
        } else if (error.message.includes('nonce')) {
            errorMessage = 'Transaction failed due to nonce issues. Please check your account.';
        } else if (error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient funds to complete the transaction.';
        } else if (error.message.includes('network')) {
            errorMessage = 'Network error. Please try again later.';
        } else if (error.message.includes('execution reverted')) {
            errorMessage = 'The transaction failed to execute. Please check the contract conditions.';
            if (error.data) {
                try {
                    const revertReason = error.data.slice(2); // Remove '0x' prefix
                    const decodedRevertReason = ethers.utils.defaultAbiCoder.decode(['string'], '0x' + revertReason);
                    console.error('Decoded Revert Reason:', decodedRevertReason[0]);
                } catch (decodeError) {
                    console.error('Error decoding revert reason:', decodeError);
                }
            }
        } else {
            errorMessage = error.message;
        }

        window.unityIns.SendMessage('TransactionManager', 'OnTransactionResponse', `error:${errorMessage}`);
    }
}