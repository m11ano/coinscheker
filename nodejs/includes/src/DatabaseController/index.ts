import mysql, { createPool } from 'mysql2';
import { PoolOptions } from 'mysql2/typings/mysql';

class DatabaseController {

    private _pool : mysql.Pool;
    private _conOpts : PoolOptions = {

    };


    //Функция для парсинга строки настроек подключения к БД (из ENV переменной)
    public static parseConnectionOptions(value : string) : PoolOptions
    {
        const result : PoolOptions = {};

        if (value.length == 0)
        {
            return result;
        }

        const valueS : string[] = value.split('&');
        const valueHostS : string[] = valueS[0].split(':');
        const valueAccessS : string[] = valueS[1] ? valueS[1].split(':') : ['',''];

        result.host = valueHostS[0];
        result.port = typeof valueHostS[1] == 'string' ? parseInt(valueHostS[1]) : undefined;
        result.user = valueAccessS[0];
        result.password = typeof valueAccessS[1] == 'string' ? valueAccessS[2] : '';
        result.database = typeof valueS[2] == 'string' ? valueS[2] : undefined;

        return result;
    }
    
    constructor(_con : PoolOptions | string)
    {
        this._conOpts = {...this._conOpts, ...(typeof _con == 'string' ? DatabaseController.parseConnectionOptions(_con) : _con)};
        this._pool = mysql.createPool(this._conOpts);

    }
    
    public get pool() : mysql.Pool
    {
        return this._pool;
    }


    public destroy() : void
    {
        this._pool.end();
    }
    
}

export default DatabaseController;