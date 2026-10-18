// Pure contract checks must not reach a local or hosted service.
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import { syncBuiltinESMExports } from 'node:module';
const deny = () => { throw new Error('Local acceptance contract suite forbids network access'); };
globalThis.fetch = deny;
http.request = http.get = https.request = https.get = deny;
net.connect = net.createConnection = tls.connect = deny;
net.Socket.prototype.connect = deny;
dgram.createSocket = deny;
syncBuiltinESMExports();
