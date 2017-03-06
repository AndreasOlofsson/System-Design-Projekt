/* jslint node: true */
'use strict';

// Require express, socket.io, and vue
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var shared = require('./public/js/shared.js');

// Add all members in 'shared.js' to the global context
for(var key in shared) {
    global[key] = shared[key];
}

// Pick arbitrary port
var port = 3000;
app.set('port', (process.env.PORT || port));

// Language should be user specific but default is set here
var lang = "sv";

// get the JSON objects for the dictated language. Wonder if functions take arguments? ;-)
var getLabelsAndMenu = function() {
    var ui = require("./data/"+ lang +"/ui.json");
    var menu = require("./data/"+ lang +"/menu.json");
    return {uiLabels: ui, menu: menu};
};

// Serve static assets from public/
app.use(express.static(path.join(__dirname, 'public/')));
// Serve vue from vue/ directory
app.use('/vue', express.static(path.join(__dirname, '/node_modules/vue/dist/')));

// Serve diner.html as root page
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'views/diner.html'));
});
// Serve kitchen.html as subpage
app.get('/kitchen', function(req, res) {
    res.sendFile(path.join(__dirname, 'views/kitchen.html'));
});

loadMenu(getLabelsAndMenu().menu);

// ------ //
var clients = [];

var Client = function(socket) {
    this.socket = socket;

    var thisClient = this;

    socket.on('initialize', function() {
        io.emit('initialize', {orders: orders.getAll(),
                               labelsAndMenu: getLabelsAndMenu() });
    });

    socket.on('order', function(order) {
		order = Order.copy(order);

		var orderId = orders.addOrder(order);

        console.log('order added: ' + order.toString());

        clients.forEach(function(client) {
            client.orderAdded(orderId, order);
        });
    });

    socket.on('statusChanged', function(orderId, newStatus) {
        orders.changeStatus(orderId, newStatus);

        clients.forEach(function(client) {
            if(client != thisClient) {
                client.orderStatusChanged(orderId, newStatus);
            }
        });
    });

    socket.on('updateOrders', function() {
        socket.emit('currentQueue', orders.getAll());
    });
};

Client.prototype.orderAdded = function(id, order) {
    this.socket.emit('orderAdded', { id: id, order: order });
};

Client.prototype.orderStatusChanged = function(id, status) {
    this.socket.emit('statusChanged', {id: id, status: status});
};

io.on('connection', function(socket) {
	  // Send list of orders and text labels when a client connects
    console.log('client connected from: ' + socket.handshake.address);

    clients.push(new Client(socket));
});

http.listen(app.get('port'), function() {
    console.log('Server listening on port ' + app.get('port'));
});
