const client = new StreamerbotClient({
    host: Config.StreamerBot?.host || '127.0.0.1',
    port: Config.StreamerBot?.port || 24585,
    endpoint: Config.StreamerBot?.endpoint || '/',
    subscribe: {
      "General": ["Custom"]
    },
    reconnect: true,
    reconnectAttempts: 5,
    reconnectInterval: 5000,
    onError: (error) => {
        console.error('WebSocket error:', error);
    },
    onClose: () => {
        console.log('WebSocket connection closed');
    },
    onData: (resp) => {
        if (!resp) {
            console.warn('Received empty response');
            return;
        }
        console.log(resp);
        try {
            let module = window.Modules.find( item => item.name.toLowerCase() == resp.data.Module.toLowerCase())
            if(typeof module !== "undefined" && typeof module.message === "function"){
                try{
                    module.message(resp.data.Data);
                }catch(err){ 
                    new ShowError(err, true);
                    console.error('Module message processing error:', err);
                }
            }
        }catch(e){ 
        }
    }
});
