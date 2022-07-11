import {WebSocket, WebSocketServer, ServerOptions}  from 'ws';
import {EventEmitter} from 'events';
import { IncomingMessage } from 'http';

interface IConfig {
    checkConnection ?: (ws : WebSocket, req : IncomingMessage) => Promise<boolean>,
    pingInterval ?: number,
}

interface IWebsocketServerEvents {
    'connection': (wsId: number, req : IncomingMessage) => void;
    'message': (wsId: number, message: any, isJson: boolean) => void;
    'close': (wsId: number) => void;
}

class IWebsocketServerEventEmitter extends EventEmitter {
    constructor() {
      super();
    }
}

declare interface IWebsocketServerEventEmitter {
    on<U extends keyof IWebsocketServerEvents>(
      event: U, listener: IWebsocketServerEvents[U]
    ): this;
  
    emit<U extends keyof IWebsocketServerEvents>(
      event: U, ...args: Parameters<IWebsocketServerEvents[U]>
    ): boolean;
}


class WebsocketServer {

    private _config : Required<IConfig> = {
        checkConnection : async (ws, req)=>{
            return new Promise((resolve, reject)=>{
                resolve(true);
            });
        },
        pingInterval : 30000,
    };
    private _eventEmitter : IWebsocketServerEventEmitter;
    private _wSServer ?: WebSocketServer;
    private _options : ServerOptions;
    private _clientsMap = new Map<number, {ws : WebSocket, isAlive : boolean}>();
    private _clientsMapCounter = 1;
    private _isStarted = false;
    private _pingIntervalId ?: NodeJS.Timeout;
    private _pingIntervalTimeoutId ?: NodeJS.Timeout;

    constructor(options : ServerOptions, config : IConfig = {}) {
        this._config = {...this._config, ...config};
        this._options = options;
        this._eventEmitter = new IWebsocketServerEventEmitter();
    }

    public start()
    {
        if (this._isStarted)
        {
            return;
        }

        this._isStarted = true;

        this._wSServer = new WebSocketServer(this._options);

        this._wSServer.on('connection', async (ws : WebSocket, req : IncomingMessage) =>
        {
            this._config.checkConnection(ws, req)
            .then(()=>
            {
                let wsId = this._clientsMapCounter++;
                this._clientsMap.set(wsId, {ws, isAlive : true});

                ws.on('close', () =>
                {
                    this._eventEmitter.emit('close', wsId);
                    this._clientsMap.delete(wsId);
                });

                ws.on('message', (message) =>
                {
                    let isJson = true;
                    try {
                        message = JSON.parse(message.toString());
                    }
                    catch (e)
                    {
                        isJson = false;
                    }

                    this._eventEmitter.emit('message', wsId, message, isJson);
                });

                ws.on('pong', () =>
                {
                    this._clientsMap.set(wsId, {ws, isAlive : true});
                });

                this._eventEmitter.emit('connection', wsId, req);
            })
            .catch((error)=>{
                ws.send(JSON.stringify(error));
                ws.close();
            });

        });

        this.startPingInterval();
    }

    private startPingInterval()
    {
        if (this._pingIntervalId)
        {
            clearTimeout(this._pingIntervalId);
        }

        this._pingIntervalId = setTimeout(()=>
        {
            for (let it of this._clientsMap)
            {
                if (it[1].isAlive == false)
                {
                    it[1].ws.terminate();
                }
                else
                {
                    it[1].isAlive = false;
                    this._clientsMap.set(it[0], it[1]);
                    it[1].ws.ping();
                }
            }

            this.startPingInterval();

        },  this._config.pingInterval);

    }

    public get event() {
        return this._eventEmitter;
    }

    public getWS(id : number) {
        let mapItem = this._clientsMap.get(id);
        if (mapItem === undefined)
        {
            return undefined;
        }
        else
        {
            return mapItem.ws;
        }
    }

    public sendJsonRPC(wsId : number, isOk : boolean, result : object | string | number | boolean, id : string | number | null = null)
    {
        let ws = this.getWS(wsId);
        if (ws)
        {
            let message : any = {};

            if (isOk)
            {
                message.result = result;
            }
            else
            {
                message.error = result;
            }

            message.id = id;

            ws.send(JSON.stringify(message));
        }
    }

    public destroy() : void {

        this._wSServer?.close();

        if (this._pingIntervalId)
        {
            clearTimeout(this._pingIntervalId);
        }
    }
    
}

export default WebsocketServer;