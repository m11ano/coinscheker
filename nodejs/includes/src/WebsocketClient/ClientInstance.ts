import {WebSocket}  from 'ws';
import {EventEmitter} from 'events';

interface IWebsocketClientInstanceEvents {
    'open': (id: number) => void;
    'close': (id: number) => void;
    'message': (id: number, message : any) => void;
    'error': (id: number, error : Error) => void;
}

class WebsocketClientInstanceEventEmitter extends EventEmitter {
    constructor() {
      super();
    }
}

declare interface WebsocketClientInstanceEventEmitter {
    on<U extends keyof IWebsocketClientInstanceEvents>(
      event: U, listener: IWebsocketClientInstanceEvents[U]
    ): this;
  
    emit<U extends keyof IWebsocketClientInstanceEvents>(
      event: U, ...args: Parameters<IWebsocketClientInstanceEvents[U]>
    ): boolean;
}

class WebsocketClientInstance {

    private _isConnected = false;
    private _isClosed = false;

    private _id = 0;
    private _url : string;
    private _timeout : number;
    private _eventEmitter : WebsocketClientInstanceEventEmitter;
    private _ws : WebSocket;
    private _pingInterval : number;
    private _pingTimeout : number;
    private _logActions : boolean;

    private _pingIntervalTimeoutId ?: NodeJS.Timeout;
    private _pingTimeoutTimeoutId ?: NodeJS.Timeout;
    private _conTimeoutId ?: NodeJS.Timeout;


    constructor(id : number, url : string, timeout : number, pingInterval : number, pingTimeout : number, logActions : boolean) {
        this._id = id;
        this._url = url;
        this._timeout = timeout;
        this._pingInterval = pingInterval;
        this._pingTimeout = pingTimeout;
        this._logActions = logActions;

        this._eventEmitter = new WebsocketClientInstanceEventEmitter();

        if (this._logActions)
        {
            console.log('Trying to connect');
        }

        this._ws = new WebSocket(this._url);

        this._conTimeoutId = setTimeout(()=>
        {
            this._isClosed = true;
            this._ws.close();
            this._eventEmitter.emit('close', this._id);
        }, this._timeout);

        this._ws.on('open', () =>
        {
            if (this._conTimeoutId)
            {
                clearTimeout(this._conTimeoutId);
            }
            this._isConnected = true;
            this.updatePingInterval();
            this._eventEmitter.emit('open', this._id);
        });

        this._ws.on('message', (message) =>
        {
            this._eventEmitter.emit('message', this._id, message);
        });

        this._ws.on('error', (error) =>
        {
            if (!this._isClosed)
            {
                this._isConnected = false;
                this._eventEmitter.emit('error', this._id, error);
            }
        });

        this._ws.on('close', () =>
        {
            if (!this._isClosed)
            {
                this._isConnected = false;
                this._eventEmitter.emit('close', this._id);
            }
        });

        this._ws.on('pong', () =>
        {
            if (this._pingTimeoutTimeoutId)
            {
                clearInterval(this._pingTimeoutTimeoutId);
            }

            this.updatePingInterval();
        });

    }

    public get id() {
        return this._id;
    }

    public get event() {
        return this._eventEmitter;
    }

    public get ws() : WebSocket {
        return this._ws;
    }

    private updatePingInterval() : void
    {
        if (this._pingIntervalTimeoutId)
        {
            clearInterval(this._pingIntervalTimeoutId);
        }

        this._pingIntervalTimeoutId = setTimeout(()=>
        {
            if (this._isConnected)
            {
                if (this._pingTimeoutTimeoutId)
                {
                    clearInterval(this._pingTimeoutTimeoutId);
                }

                this._pingTimeoutTimeoutId = setTimeout(()=>
                {
                    if (!this._isClosed)
                    {
                        this._isConnected = false;
                        this._isClosed = true;
                        this._ws.close();
                        this._eventEmitter.emit('close', this._id);
                    }

                }, this._pingTimeout);

                this._ws.ping();
            }
        }, this._pingInterval);
    }

    public destroy()
    {
        if (this._conTimeoutId)
        {
            clearTimeout(this._conTimeoutId);
        }

        if (this._pingIntervalTimeoutId)
        {
            clearInterval(this._pingIntervalTimeoutId);
        }

        if (this._pingTimeoutTimeoutId)
        {
            clearInterval(this._pingTimeoutTimeoutId);
        }

        if (this._isConnected)
        {
            this._isClosed = true;
            this._ws.close();
        }
    }
}

export default WebsocketClientInstance;