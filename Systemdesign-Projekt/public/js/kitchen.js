'use strict';

var vue, socket;

// ***************************
function kitchenPageLoaded() {
    displayItems();

	vue = new Vue({
		el: '#knapp',
		methods: {
			send: function() {
				sendOrder();
			},
			ready: function() {
				changeRdy();
			}
		}
	});

	socket = io();

	socket.on('initialize', function(data) {
		loadMenu(data.labelsAndMenu.menu);

		orders.updateOrders(Order.copyAll(data.orders));
		updateAllOrderViews();
		window.debug = data.labelsAndMenu;
		// TODO handle data.labelsAndMenu
	});

	socket.on('currentQueue', function(newOrders) {
		orders.updateOrders(Order.copyAll(newOrders));
		updateAllOrderViews();
	});

	socket.on('orderAdded', function(data) {
		var order = Order.copy(data.order);
		orders.addOrder(order, data.id);
		var view = createOrderView(order);
		insertOrderView(view);
	});

	socket.on('statusChanged', function(data) {
		orders.changeStatus(data.id, data.status);
		updateAllOrderViews(); // TODO optimize
	});

	socket.emit('initialize');

	window.setInterval(updateFoodTimes, 1000);
};

// ***************************

function displayItems() {
	displayButton('knapp', "Send order from bar");
};

// **********
function displayButton(id, txt) {
	var button	= document.getElementById(id);
	button.append(txt);
};

window.addEventListener("load", kitchenPageLoaded);

// ***************************
var table = 0;

function sendOrder() {
	var order = new Order(table, [new OrderItem(0, 1, ["no onion"])], new Date().getTime());
	orders.addOrder(order);

	insertOrderView(createOrderView(order));

	table++;
};

function createOrderView(order) {
	var templateItems = [];

	order.orderItems.forEach(function(orderItem) {
		if(orderItem.specials) {
			var specialViews = [];

			orderItem.specials.forEach(function(special) {
				specialViews.push(special);
			});

			console.log(specialViews);

			templateItems.push(templater.create(
				"orderItem",
				{
					text: orderItem.count + " " + items[orderItem.id].name,
					specials: specialViews
				}
			));
		} else {
			templateItems.push(templater.create(
				"orderItem",
				{
					text: orderItem.count + " " + items[orderItem.id].name
				}
			));
		}
	});

	var view = templater.create(
		"order",
		{
			order: order,
			table: order.table,
			items: templateItems
		}
	);

	templater.getNode(view, "button").addEventListener(
		"click", function(e) {
			var order = templater.getData(e.target, "order");

			order.status++;

			if(order.status == OrderStatus.Finished + 1) {
				order.status = OrderStatus.Added;
			}
			insertOrderView(templater.getRootNode(e.target));

			e.target.className = "orderButton orderButton" + order.status;
		}
	);

	return view;
};

function insertOrderView(view) {
	var order = templater.getData(view, "order");
	var list;

	if(order.status == OrderStatus.Delivered) {
		return;
	} else if(order.status == OrderStatus.Finished) {
		list = document.getElementById("completed");
	} else {
		list = document.getElementById("ongoing");
	}

	for(var i = 0; i < list.children.length; i++) {
		var listOrder = templater.getData(list.children[i], "order");

		if(listOrder.time > order.time) {
			list.children[i].insertAdjacentElement("beforebegin", view);
			return;
		}
	}

	list.appendChild(view);
};

function updateFoodTimes() {
	var now = new Date();

	function updateTime(node) {
		var order = templater.getData(node, "order");

		templater.setVariable(node, "time", order.getTimeAgoAdded());
	};

	var list = document.getElementById("ongoing");

	for(var i = 0; i < list.children.length; i++) {
		updateTime(list.children[i]);
	}

	list = document.getElementById("completed");

	for(var i = 0; i < list.children.length; i++) {
		updateTime(list.children[i]);
	}
};

function updateAllOrderViews() {
	function removeView(child) {
		child.remove();
	};

	document.getElementById("ongoing").children.forEach(removeView);
	document.getElementById("completed").children.forEach(removeView);

	orders.getAll().forEach(function(order) {
		var view = createOrderView(order);

		insertOrderView(view);
	});
};

// ---------- //

if(!HTMLCollection.prototype.forEach) {
	HTMLCollection.prototype.forEach = function(func) {
		var children = [];

		for(var i = 0; i < this.length; i++) {
			children.push(this[i]);
		}

		children.forEach(func);
	};
}