
interface queueItem <T1, T2> {
    data : T1,
    triesCount : number,
    ready : (result : T2) => void,
    error : Function
}

export default class queueWithDelay <T1, T2> {

    private _queue : queueItem<T1, T2>[] = [];
    private _isGoing : boolean = false;
    private _lastTime : number = 0;

    constructor(private _delay : number, private _handler : (data : T1, ready : (result : T2) => void, error : Function, triesCount : number, repeat : (wait : boolean) => void) => Promise<void>) {}

    public add(data : T1)
    {
        return new Promise((ready, error)=>{
            this.addToQueue(data, ready, error, 0)
        });
    }

    private addToQueue(data : T1, ready : (result : T2) => void, error : Function, triesCount : number)
    {
        this._queue.push({data, ready, error, triesCount});
        this.exec();
    }

    private repeatTask(data : T1, ready : (result : T2) => void, error : Function, triesCount : number)
    {
        this._queue.unshift({data, ready, error, triesCount});
        this.exec(true);
    }

    private exec(ignoreGoing = false)
    {
        if (this._isGoing && ignoreGoing == false)
        {
            return;
        }

        let item = this._queue.shift();
        if (item !== undefined)
        {
            this._isGoing = true;
            this._lastTime = Date.now();

            this._handler(item.data, item.ready, item.error, item.triesCount, (wait : boolean)=>{
                if (item)
                {
                    const timeToWait = this._delay - (Date.now() - this._lastTime);

                    if (timeToWait > 0)
                    {
                        setTimeout(()=>{
                            if (item)
                            {
                                this.repeatTask(item.data, item.ready, item.error, item.triesCount + 1);
                            }
                        }, timeToWait);
                    }
                    else
                    {
                        this.repeatTask(item.data, item.ready, item.error, item.triesCount + 1);
                    }
                }
            })
            .then(()=>
            {
                const timeToWait = this._delay - (Date.now() - this._lastTime);

                if (timeToWait > 0)
                {
                    setTimeout(()=>{
                        this._isGoing = false;
                        this.exec();
                    }, timeToWait);
                }
                else
                {
                    this._isGoing = false;
                    this.exec();
                }
            });
        }
    }


}