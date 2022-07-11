import {WebSocket}  from 'ws';
import {EventEmitter} from 'events';

import WebsocketClientInstance from './ClientInstance';

interface IConfig {
    url : string,
    timeout ?: number,
    connectionTimeouts ?: Array<number[]>, //array: [0 - trying count, 1 - timeout]
    seamlessReconnectInterval ?: number,
    autoReconnect ?: boolean,
    pingInterval ?: number,
    pingTimeout ?: number,
    logActions ?: boolean,
}

interface IWebsocketClientEvents {
    'connectNewInstance': (instance: WebsocketClientInstance, ready: Function) => void;
    'readyNewInstance': (instance: WebsocketClientInstance) => void;
    'message': (instance: WebsocketClientInstance, message: any, isJson: boolean) => void;
    'error': (instance: WebsocketClientInstance, error: Error) => void;
    'close': (instance: WebsocketClientInstance) => void;
}

class WebsocketClientEventEmitter extends EventEmitter {
    constructor() {
      super();
    }
}

declare interface WebsocketClientEventEmitter {
    on<U extends keyof IWebsocketClientEvents>(
      event: U, listener: IWebsocketClientEvents[U]
    ): this;
  
    emit<U extends keyof IWebsocketClientEvents>(
      event: U, ...args: Parameters<IWebsocketClientEvents[U]>
    ): boolean;
}


class WebsocketClient {

    private _isConnected = false;
    private _connectionsTryCount = 0;
    private _reconnectTimeoutId ?: NodeJS.Timeout;
    private _seamlessReconnectTimeoutId ?: NodeJS.Timeout;
    private _clearTryCountTimeoutId ?: NodeJS.Timeout;

    private _config : Required<IConfig> = {
        url : '',
        timeout : 15000,
        connectionTimeouts : [[0,1],[1,100],[2,1000],[10,10000],[Infinity,60000]],
        seamlessReconnectInterval : 0,
        autoReconnect : true,
        pingInterval : 30000,
        pingTimeout : 30000,
        logActions : true,
    };
    private _eventEmitter : WebsocketClientEventEmitter;

    private _websockeInstancestStorage : {[id: number]: WebsocketClientInstance} = {};
    private _websocketInstancestStorageCounter = 0;
    private _websocketInstancestStorageNowIndex = 0;
    private _websocketInstancestStorageLastIndex = 0;

    constructor(config : IConfig) {
        this._config = {...this._config, ...config};
        this._eventEmitter = new WebsocketClientEventEmitter();
    }

    public get event() {
        return this._eventEmitter;
    }

    private getTimeoutFromConfig(c : number) : number
    {
        for (let i in this._config.connectionTimeouts)
        {
            if (c <= this._config.connectionTimeouts[i][0])
            {
                return this._config.connectionTimeouts[i][1];
            }
        }

        return 1000;
    }

    public startNewInstance() : void
    {
        if (this._reconnectTimeoutId)
        {
            clearTimeout(this._reconnectTimeoutId);
        }

        this._reconnectTimeoutId = setTimeout(()=>
        {
            this.makeNewWebsocketClientInstance();
        }, this.getTimeoutFromConfig(this._connectionsTryCount));
    }

    private makeNewWebsocketClientInstance()
    {
        this._connectionsTryCount++;
        this._websocketInstancestStorageCounter++;
        let i = this._websocketInstancestStorageCounter;

        this._websockeInstancestStorage[i] = new WebsocketClientInstance(i, this._config.url, this._config.timeout, this._config.pingInterval, this._config.pingTimeout, this._config.logActions);

        let ready = ()=>{
            if (i > this._websocketInstancestStorageLastIndex)
            {
                this._websocketInstancestStorageNowIndex = i;
                this._isConnected = true;

                this._clearTryCountTimeoutId = setTimeout(()=>{
                    this._connectionsTryCount = 0;
                }, 10000);

                if (this._websocketInstancestStorageLastIndex > 0 && this._websockeInstancestStorage[this._websocketInstancestStorageLastIndex] !== undefined)
                {
                    this._websockeInstancestStorage[this._websocketInstancestStorageLastIndex].destroy();
                    delete this._websockeInstancestStorage[this._websocketInstancestStorageLastIndex];
                }

                this._websocketInstancestStorageLastIndex = i;

                if (this._config.seamlessReconnectInterval > 0)
                {
                    this._seamlessReconnectTimeoutId = setTimeout(()=>{
                        //console.log('Переподключаемся безшовно!');
                        this.startNewInstance();
                    }, this._config.seamlessReconnectInterval);

                    //console.log('Управление переключено на инстанс: ', i);
                }

                this._eventEmitter.emit('readyNewInstance', this._websockeInstancestStorage[i]);
            }
        };

        this._websockeInstancestStorage[i].event.on('open', (id)=>{
            if (id > this._websocketInstancestStorageNowIndex && this._websockeInstancestStorage[id] !== undefined)
            {
                this._eventEmitter.emit('connectNewInstance', this._websockeInstancestStorage[id], ready);
            }
        });

        this._websockeInstancestStorage[i].event.on('message', (id, message)=>{
            if (this._websocketInstancestStorageNowIndex == id && this._websockeInstancestStorage[id] !== undefined)
            {
                let isJson = true;
                try {
                    message = JSON.parse(message.toString());
                }
                catch (e)
                {
                    isJson = false;
                }
                this._eventEmitter.emit('message', this._websockeInstancestStorage[id], message, isJson);
            }
        });

        this._websockeInstancestStorage[i].event.on('error', (id, error)=>{

            if (this._websocketInstancestStorageNowIndex == id && this._websockeInstancestStorage[id] !== undefined)
            {
                this._eventEmitter.emit('error', this._websockeInstancestStorage[id], error);
            }
        });

        this._websockeInstancestStorage[i].event.on('close', (id)=>{

            if (id > this._websocketInstancestStorageNowIndex && this._websockeInstancestStorage[id] !== undefined)
            {
                this._websockeInstancestStorage[id].destroy();
                delete this._websockeInstancestStorage[id];
                this.startNewInstance();
            }
            else if (id == this._websocketInstancestStorageNowIndex && this._websockeInstancestStorage[id] !== undefined)
            {
                if (this._clearTryCountTimeoutId)
                {
                    clearTimeout(this._clearTryCountTimeoutId);
                }

                if (this._seamlessReconnectTimeoutId)
                {
                    clearTimeout(this._seamlessReconnectTimeoutId);
                }

                this._isConnected = false;
                this._eventEmitter.emit('close', this._websockeInstancestStorage[id]);

                if (this._config.autoReconnect)
                {
                    this.startNewInstance();
                }
            }
            
        });
    }

    public get wsi() : WebsocketClientInstance | null {
        return this._websocketInstancestStorageNowIndex > 0 && this._websockeInstancestStorage[this._websocketInstancestStorageNowIndex] !== undefined ? this._websockeInstancestStorage[this._websocketInstancestStorageNowIndex] : null;
    }

    public get isConnected() : boolean {
        return this._isConnected;
    }

    public destroy() : void {

        if (this._reconnectTimeoutId)
        {
            clearTimeout(this._reconnectTimeoutId);
        }

        if (this._seamlessReconnectTimeoutId)
        {
            clearTimeout(this._seamlessReconnectTimeoutId);
        }

        for (let i in this._websockeInstancestStorage)
        {
            this._websockeInstancestStorage[i].destroy();
        }
    }
    
}

export default WebsocketClient;