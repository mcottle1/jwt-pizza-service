const request = require('supertest');
const app = require('../service');
const { DB } = require('../database/database.js');

const testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken, testUserId;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
  const registerRes = await request(app).post('/api/auth').send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
});

afterAll(async () => {
  const connection = await DB.getConnection();
  connection.end();
});

test('login', async () => {
  const loginRes = await request(app).put('/api/auth').send(testUser);
  expect(loginRes.status).toBe(200);
  expect(loginRes.body.token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);

  const { password, ...user } = { ...testUser, roles: [{ role: 'diner' }] }
  expect(loginRes.body.user).toMatchObject(user);
  expect(password).toBe('a');
});

test('update', async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com!';
  const response = await request(app)
    .put('/api/auth/' + testUserId)
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send(testUser);

  expect(response.status).toBe(200); 
  expect(response.body.email.slice(-1)).toMatch("!");
});

test('logout', async () => {
  const response = await request(app)
    .delete('/api/auth/')
    .set('Authorization', `Bearer ${testUserAuthToken}`);

  expect(response.status).toBe(200); 
  expect(response.body).toMatchObject({ message: 'logout successful' });
});

test('logoutfail', async () => {
  const response = await request(app)
    .delete('/api/auth/')
    .set('Authorization', `Bearer 1234`);

  expect(response.status).toBe(401); 
  expect(response.body).toMatchObject({ message: 'unauthorized' });
});