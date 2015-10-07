var net = require('net'),
    repl = require('repl'),
    hostname = require('os').hostname();

function ReplPlugin(options) {
    var self = this,
        tcpRepl, tcpServer, socketServer, socketRepl, stdinRepl;

    options = options || {};

    this.port = options.port || 5001;
    this.socket = options.socket || '/tmp/lapidus' + '.' + process.pid;
    this.stdin = options.stdin || false;
    this.prompt = options.prompt || ReplPlugin.prototype.getPrompt();
    this.replContext = options.replContext || {};
    this.tcpLocalOnly = typeof options.tcpLocalOnly === 'boolean' ? options.tcpLocalOnly : true;

    this.connections = 0;

    if (this.stdin) {
        stdinRepl = repl.start({
            prompt: self.prompt,
            input: process.stdin,
            output: process.stdout
        });

        stdinRepl.on('reset', ReplPlugin.prototype.copyContext.bind(self));
    }

    if (this.port) {
        tcpServer = net.createServer(function (socket) {
            self.connections += 1;

            tcpRepl = repl.start({
                prompt: self.prompt,
                input: socket,
                output: socket
            }).on('exit', function () {
                socket.end();
            });

            tcpRepl.on('reset', ReplPlugin.prototype.copyContext.bind(self));

        }).listen(self.port);

        tcpServer.on('connection', function (socket) {
            var address = socket.address().address.toString().replace('::ffff:', ''),
                connections = self.connections;

            if (self.tcpLocalOnly && address.indexOf('127.0.0.1') === -1 && address.indexOf('::1') === -1) {
                console.error('REPL: Local connections only; closing connection #' + connections + ' from: ' + address);
                socket.write('\n4 8 15 16 23 42\n');
                socket.destroy();
            } else {
                console.log('REPL: Connection #' + connections + ' established from: ' + address);

                socket.on('close', function () {
                    console.log('REPL: Connection #' + connections + ' closed.');
                });

                socket.on('error', function (error) {
                    console.log('REPL: Connection #' + connections + ' error: ' + error);
                });
            }
        });
    }

    if (this.socket) {
        socketServer = net.createServer(function (socket) {
            self.connections += 1;

            socketRepl = repl.start({
                prompt: self.prompt,
                input: socket,
                output: socket
            }).on('exit', function() {
                socket.end();
            });

            socketRepl.on('reset', ReplPlugin.prototype.copyContext.bind(self));

        }).listen(self.socket);

        socketServer.on('connection', function (socket) {
            var connections = self.connections;

            console.log('REPL: Connection #' + connections + ' established from: ' + self.socket);

            socket.on('close', function () {
                console.log('REPL: Connection #' + connections + ' closed.');
            });

            socket.on('error', function (error) {
                console.log('REPL: Connection #' + connections + ' error: ' + error);
            });
        });
    }
}

ReplPlugin.prototype.getPrompt = function getPrompt() {
    var prompt = 'LAPIDUS [';

    if (typeof cluster !== 'undefined') {
        prompt += cluster.isMaster ? 'MASTER' : ('WORKER #' + cluster.worker.id);
    } else {
        prompt += hostname;
    }

    return prompt + ']> ';
};

ReplPlugin.prototype.copyContext = function copyContext(context) {
    var replContext = this.replContext,
        prop;

    for (prop in replContext) {
        if (replContext.hasOwnProperty(prop)) {
            context[prop] = replContext[prop];
        }
    }
};

module.exports = ReplPlugin;