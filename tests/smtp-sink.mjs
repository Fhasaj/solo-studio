// Minimal SMTP server for tests: accepts every message and appends it to a JSON-lines file
import net from 'net';
import fs from 'fs';
const out = process.argv[2];
net.createServer((socket) => {
  let data = null;
  let mail = { to: [], body: '' };
  socket.write('220 sink ESMTP\r\n');
  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let index;
    while ((index = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      if (data !== null) {
        if (line === '.') {
          fs.appendFileSync(out, JSON.stringify({ to: mail.to, body: data }) + '\n');
          data = null;
          mail = { to: [], body: '' };
          socket.write('250 OK\r\n');
        } else data += line.replace(/^\./, '') + '\n';
        continue;
      }
      const cmd = line.slice(0, 4).toUpperCase();
      if (cmd === 'EHLO') socket.write('250-sink\r\n250 8BITMIME\r\n');
      else if (cmd === 'HELO') socket.write('250 sink\r\n');
      else if (cmd === 'RCPT') { mail.to.push(line.slice(8)); socket.write('250 OK\r\n'); }
      else if (cmd === 'DATA') { data = ''; socket.write('354 go\r\n'); }
      else if (cmd === 'QUIT') { socket.write('221 bye\r\n'); socket.end(); }
      else socket.write('250 OK\r\n');
    }
  });
  socket.on('error', () => {});
}).listen(2525, '127.0.0.1');
