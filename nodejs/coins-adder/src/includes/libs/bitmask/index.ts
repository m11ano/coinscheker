
class bitmaskItem {

    constructor (private _mask : boolean[]) {}

    toArray() : boolean[]
    {
        return this._mask;
    }

    toString() : string
    {
        let result = '';
        for (let i of this._mask)
        {
            result += i ? '1' : '0';
        }

        return result;
    }

    toInt() : number
    {
        return parseInt(this.toString(), 2);
    }
}

export default class bitmask {

    constructor(public readonly lenght : number) {}


    private stringFillEmpty(str : string, side : string = 'left') : string
    {
        const dif = this.lenght - str.length;
        if (dif > 0)
        {
            for (let i = 0; i < dif; i++)
            {
                str = side == 'left' ? '0' + str : str + '0';
            }
        }

        return str;
    }

    private arrayFillEmpty(arr : boolean[], side : string = 'left') : boolean[]
    {
        const dif = this.lenght - arr.length;
        if (dif > 0)
        {
            for (let i = 0; i < dif; i++)
            {
                if (side == 'left')
                {
                    arr.unshift(false)
                }
                else
                {
                    arr.push(false);
                }
            }
        }

        return arr;
    }

    private stringToArray(value : string)
    {
        let result : boolean[] = [];

        for (let i = 0; i < value.length; i++)
        {
            result.push(value.charAt(i) == '1' ? true : false);
        }

        return result;
    }

    fromBuffer(value : Buffer)
    {
        let str = '';

        for (let i of value)
        {
            str += this.stringFillEmpty(i.toString(2));
        }

        return new bitmaskItem(this.stringToArray(str));
    }

    fromString(value : string, fillEmptySide : 'left' | 'right' = 'left')
    {
        return new bitmaskItem(this.stringToArray(this.stringFillEmpty(value, fillEmptySide)));
    }

    fromArray(value : boolean[], fillEmptySide : 'left' | 'right' = 'left')
    {
        return new bitmaskItem(this.arrayFillEmpty(value, fillEmptySide));
    }

}