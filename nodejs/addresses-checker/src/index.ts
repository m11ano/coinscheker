import 'dotenv/config';
import App from './App';

const app = new App();

process.on('exit', ()=>{
    app.destroy();
});

process.on('SIGINT', ()=>{
    app.destroy();
    process.exit(1);
});

process.on('SIGUSR1', ()=>{
    app.destroy();
    process.exit(2);
});

process.on('SIGUSR2', ()=>{
    app.destroy();
    process.exit(3);
});

process.on('uncaughtException', (e)=>{
    console.log('uncaughtException!');
    console.log(e);
    //app.destroy();
    //process.exit(4);
});

//process.stdin.resume();

app.start();