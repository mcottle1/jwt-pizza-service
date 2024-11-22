const express = require('express');
const config = require('../config.js');
const { Role, DB } = require('../database/database.js');
const { authRouter } = require('./authRouter.js');
const { asyncHandler, StatusCodeError } = require('../endpointHelper.js');
const logger = require('../logger.js');
const AbortController = require('abort-controller');

const orderRouter = express.Router();

orderRouter.endpoints = [
  {
    method: 'GET',
    path: '/api/order/menu',
    description: 'Get the pizza menu',
    example: `curl localhost:3000/api/order/menu`,
    response: [{ id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }],
  },
  {
    method: 'PUT',
    path: '/api/order/menu',
    requiresAuth: true,
    description: 'Add an item to the menu',
    example: `curl -X PUT localhost:3000/api/order/menu -H 'Content-Type: application/json' -d '{ "title":"Student", "description": "No topping, no sauce, just carbs", "image":"pizza9.png", "price": 0.0001 }'  -H 'Authorization: Bearer tttttt'`,
    response: [{ id: 1, title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 }],
  },
  {
    method: 'GET',
    path: '/api/order',
    requiresAuth: true,
    description: 'Get the orders for the authenticated user',
    example: `curl -X GET localhost:3000/api/order  -H 'Authorization: Bearer tttttt'`,
    response: { dinerId: 4, orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [{ id: 1, menuId: 1, description: 'Veggie', price: 0.05 }] }], page: 1 },
  },
  {
    method: 'POST',
    path: '/api/order',
    requiresAuth: true,
    description: 'Create a order for the authenticated user',
    example: `curl -X POST localhost:3000/api/order -H 'Content-Type: application/json' -d '{"franchiseId": 1, "storeId":1, "items":[{ "menuId": 1, "description": "Veggie", "price": 0.05 }]}'  -H 'Authorization: Bearer tttttt'`,
    response: { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' },
  },
];

// getMenu
orderRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    res.send(await DB.getMenu());
  })
);

// addMenuItem
orderRouter.put(
  '/menu',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    if (!req.user.isRole(Role.Admin)) {
      throw new StatusCodeError('unable to add menu item', 403);
    }

    const addMenuItemReq = req.body;
    await DB.addMenuItem(addMenuItemReq);
    res.send(await DB.getMenu());
  })
);

// getOrders
orderRouter.get(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    res.json(await DB.getOrders(req.user, req.query.page));
  })
);

// createOrder
orderRouter.post(
  '/',
  authRouter.authenticateToken,
  asyncHandler(async (req, res) => {
    const orderReq = req.body;

    try {
      // Add order to database
      const order = await DB.addDinerOrder(req.user, orderReq);

      // Setup AbortController for timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort(); // Abort the fetch request after 10 seconds
      }, 10000);

      try {
        // Make the external API call
        const r = await fetch(`${config.factory.url}/api/order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${config.factory.apiKey}`,
          },
          body: JSON.stringify({
            diner: {
              id: req.user.id,
              name: req.user.name,
              email: req.user.email,
            },
            order,
          }),
          signal: controller.signal, // Pass the signal to fetch
        });

        clearTimeout(timeout); // Clear timeout if fetch is successful
        const j = await r.json();

        // Log response and send data back to user
        logger.log(
          logger.statusToLogLevel(r.status),
          'factory',
          {
            authorized: 'true',
            path: `${config.factory.url}/api/order`,
            method: 'POST',
            statusCode: r.status,
            reqBody: JSON.stringify({
              diner: { id: req.user.id, name: req.user.name, email: req.user.email },
              order,
            }),
            resBody: JSON.stringify({ order, jwt: j.jwt, reportUrl: j.reportUrl }),
          }
        );

        if (r.ok) {
          res.send({ order, jwt: j.jwt, reportUrl: j.reportUrl });
        } else {
          res.status(500).send({ message: 'Failed to fulfill order at factory', reportUrl: j.reportUrl });
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          res.status(408).send({ message: 'Request to factory API timed out' });
        } else {
          throw err; // Handle other types of errors
        }
      }
    } catch (error) {
      console.error('Error handling order request:', error);
      res.status(500).send({ message: 'An error occurred while processing your order' });
    }
  })
);

module.exports = orderRouter;
