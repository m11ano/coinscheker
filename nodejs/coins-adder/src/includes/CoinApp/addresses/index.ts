import {AddressStatuses} from './enum';

import bitmask from './../../libs/bitmask';

import DatabaseController from './../../DatabaseController';
import {CoinAppNetworksFactory} from './../';

import { RowDataPacket, FieldPacket } from 'mysql2';
import mysql from 'mysql2';
import { MakeDirectoryOptions } from 'fs';
import { markAsUntransferable } from 'worker_threads';

interface IAddressObject {
    id : number,
    value : string,
    networkFormat : number,
    isSmartContract : boolean,
    isSmartContractChecks : boolean[],
    status : AddressStatuses,
    exchangeId : number,
    spec ?: {
        name : string
    }
}

export default class CoinAppAddressesFactory {

    private _isSmartContractChecks__mask : bitmask;

    constructor(private _DB : DatabaseController, private _networksFactory : CoinAppNetworksFactory)
    {
        this._isSmartContractChecks__mask = new bitmask(2);
    }

    async getAddressByValue(format : string, value : string) : Promise<IAddressObject | undefined>
    {
        const formatObject = this._networksFactory.getFormat(format);
        if (formatObject === undefined)
        {
            throw new Error('Format not found');
        }

        let data;
        try {
            [data] = await this._DB.pool.promise().query<Array<RowDataPacket>>("\
                SELECT *\
                FROM `addresses` as m\
                WHERE networkFormat = ? AND value = ?\
                LIMIT 1\
            ", [formatObject.format.id, value]);

            if (data.length > 0)
            {
                let item = data[0];
                let result : IAddressObject = {
                    id : item.id,
                    value : item.value,
                    networkFormat : item.networkFormat,
                    isSmartContract : item.isSmartContract[0].toString(2) == '1' ? true : false,
                    isSmartContractChecks : this._isSmartContractChecks__mask.fromBuffer(item.isSmartContractChecks).toArray(),
                    status : item.status,
                    exchangeId : item.exchangeId,
                };

                try {
                    let [dataSpec] = await this._DB.pool.promise().query<Array<RowDataPacket>>("\
                        SELECT *\
                        FROM `addresses_spec` as m\
                        WHERE id = ?\
                        LIMIT 1\
                    ", [result.id]);
        
                    if (dataSpec.length > 0)
                    {
                        result.spec = {
                            name : dataSpec[0].name
                        }
                    }
                    
                }
                catch(e)
                {
                    throw e;
                }

                return result;
            }
            else
            {
                return undefined;
            }
            
        }
        catch(e)
        {
            throw e;
        }
    }

    async addAddress(format : string, value : string, isSmartContract : boolean | undefined = undefined, checkIsSmartContract : false | {by : 'format' | 'network', value ?: string } = false, status : AddressStatuses | undefined = undefined, checkStatus : Boolean = false, exchangeId : number = 0, spec : {name ?: string} = {})
    : Promise<{
        created : boolean,
        address : IAddressObject
    }>
    {
        const formatObject = this._networksFactory.getFormat(format);
        if (formatObject === undefined)
        {
            throw new Error('Format not found');
        }

        if (formatObject.format.value == 'erc')
        {
            if (value.length == 42)
            {
                value = value.slice(2);
            }
            else if (value.length != 40)
            {
                throw new Error('Address string length shoud be 40')
            }
        }

        let address;
        try {
            address = await this.getAddressByValue(format, value);
        }
        catch(e)
        {
            throw e;
        }

        if (address === undefined)
        {
            let isSmartContractChecks = this._isSmartContractChecks__mask.fromString('').toArray();

            if (isSmartContract === undefined)
            {
                isSmartContract = false;

                if (typeof checkIsSmartContract == 'object' && checkIsSmartContract.by == 'format')
                {
                    let networks = this._networksFactory.getNetworksByFormat(format);
                    for (let i in networks)
                    {
                        if (networks[i].provider)
                        {
                            try {
                                let check = await this.checkAdrressIsSmartContract(value, networks[i].network.value);
                                isSmartContractChecks[networks[i].network.formatIndex] = true;

                                if (check)
                                {
                                    isSmartContract = true;
                                    break;
                                }
                            }
                            catch(e)
                            {
                                throw e;
                            }
                        }
                    }
                }
                else if (typeof checkIsSmartContract == 'object' && checkIsSmartContract.by == 'network' && checkIsSmartContract.value)
                {
                    let checkNetwork = this._networksFactory.getNetwork(checkIsSmartContract.value);
                    if (checkNetwork)
                    {
                        try {
                            let check = await this.checkAdrressIsSmartContract(value, checkNetwork.network.value);
                            isSmartContractChecks[checkNetwork.network.formatIndex] = true;

                            if (check)
                            {
                                isSmartContract = true;
                            }
                        }
                        catch(e)
                        {
                            throw e;
                        }
                    }
                }
            }

            let item : any = {
                value : value,
                networkFormat : formatObject.format.id,
                isSmartContract : isSmartContract ? 1 : 0,
                isSmartContractChecks : this._isSmartContractChecks__mask.fromArray(isSmartContractChecks).toInt(),
                status : status === undefined ? 0 : status,
                exchangeId : exchangeId,
            };

            try {
                let [result] : any = await this._DB.pool.promise().query("INSERT INTO `addresses` SET ?", item);
    
                item.id = result.insertId;
            }
            catch(e)
            {
                throw e;
            }

            let addressResult : IAddressObject = {
                ...item,
                isSmartContract : isSmartContract,
                isSmartContractChecks : isSmartContractChecks,
            };

            if (Object.keys(spec).length > 0)
            {
                let specItem : any = {
                    id : item.id,
                    name : spec.name === undefined ? '' : spec.name
                };

                try {
                    let [result] : any = await this._DB.pool.promise().query("INSERT INTO `addresses_spec` SET ?", specItem);

                    addressResult.spec = {
                        name : specItem.name
                    };
                }
                catch(e)
                {
                    throw e;
                }                
            }

            return {
                created : true,
                address : addressResult,
            }

        }
        else
        {
            return {
                created : false,
                address : address
            }
        }


    }

    async checkAdrressIsSmartContract(value : string, network : string)
    {
        let result = false;
        let checkNetwork = this._networksFactory.getNetwork(network);
        if (checkNetwork)
        {
            if (checkNetwork.format.value == 'erc' && checkNetwork.provider)
            {
                try {
                    let check = await checkNetwork.provider.eth.getCode('0x' + value);
                    if (check.length > 2)
                    {
                        result = true; 
                    }
                }
                catch (e)
                {
                    throw e;
                }
            }

            return result;
        }
        else
        {
            throw new Error('Not created network provider');
        }
    }


};