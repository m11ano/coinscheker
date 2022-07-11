import {NetworkProvidersApps} from './enum';

import DatabaseController from './../../DatabaseController';
import { RowDataPacket, FieldPacket } from 'mysql2';

import Web3 from 'web3';

interface INetworkObject {
    id : number,
    value : string,
    name : string,
    format : number,
    formatIndex : number,
    providerCoinsAdder : string,
    providerCoinsTransersUpdater : string
}
 
interface IFormatObject {
    id : number,
    value : string,
    name : string
}

interface IDataItem {
    network : INetworkObject,
    format : IFormatObject,
    provider ?: Web3
};

interface IDataFormatItem {
    format : IFormatObject,
    networks : string[]
};

export default class CoinAppNetworksFactory {

    private _data : {[value : string] : IDataItem} = {};
    private _dataFormats : {[value : string] : IDataFormatItem} = {};

    constructor(
        private _DB : DatabaseController,
        private _providerApp : NetworkProvidersApps | null = null,
        private _contextNetwork : string | null = null
    ) {

    }

    public async loadData()
    {
        let data;
        try {
            [data] = await this._DB.pool.promise().query<Array<RowDataPacket>>("\
                SELECT m.*, nf.value as format_value, nf.name as format_name\
                FROM `networks` as m\
                JOIN `networks_formats` as nf ON nf.id = m.format\
            ");
        }
        catch(e)
        {
            throw e;
        }

        this._data = {};
        this._dataFormats = {};

        for (let item of data)
        {
            this._data[item.value] = {
                network : {
                    id : item.id,
                    value : item.value,
                    name : item.name,
                    format : item.format,
                    formatIndex : item.formatIndex,
                    providerCoinsAdder : item.providerCoinsAdder,
                    providerCoinsTransersUpdater : item.providerCoinsTransersUpdater
                },
                format : {
                    id : item.format,
                    value : item.format_value,
                    name : item.format_name,
                },
            };

            if (this._providerApp === NetworkProvidersApps.CoinsAdder)
            {
                this._data[item.value].provider = new Web3(this._data[item.value].network.providerCoinsAdder);
            }
            else if (this._providerApp === NetworkProvidersApps.CoinsTransersUpdater)
            {
                this._data[item.value].provider = new Web3(this._data[item.value].network.providerCoinsTransersUpdater);
            }

            if (this._dataFormats[item.format_value] === undefined)
            {
                this._dataFormats[item.format_value] = {
                    format : this._data[item.value].format,
                    networks : [item.value]
                }
            }
            else
            {
                this._dataFormats[item.format_value].networks.push(item.value);
            }
        }
    }
    
    get network() : IDataItem | undefined
    {
        return !this._contextNetwork ? undefined : this._data[this._contextNetwork];
    }

    get networks()
    {
        return this._data;
    }

    get formats()
    {
        return this._dataFormats;
    }

    getNetwork(value : string) : IDataItem | undefined
    {
        return this._data[value];
    }

    getNetworksByFormat(value : string)
    {
        let result : typeof this._data = {};

        for (let i in this._data)
        {
            if (this._data[i].format.value == value)
            {
                result[this._data[i].network.value] = this._data[i];
            }
        }

        return result;
    }

    getFormat(value : string) : IDataFormatItem | undefined
    {
        return this._dataFormats[value];
    }

    getFormatById(value : number) : IDataFormatItem | undefined
    {
        for (let i in this._dataFormats)
        {
            if (this._dataFormats[i].format.id === value)
            {
                return this._dataFormats[i];
            }
        }

        return undefined;
    }

};