const request = require('supertest');
const app = require('../service');

const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + '@admin.com';

  await DB.addUser(user);

  user.password = 'toomanysecrets';
  return user;
}

let adminUser, testUser, testUserAuthToken;

beforeAll(async () => {
    adminUser = await createAdminUser();
    testUser = { name: adminUser.name, email: adminUser.email, password: adminUser.password };
    const loginRes = await request(app).put('/api/auth').send(testUser);
    testUserAuthToken = loginRes.body.token;
});

afterAll(async () => {
    const connection = await DB.getConnection();
    connection.end();
});

test('getMenu', async () => {
    const menuRes = await request(app).get('/api/order/menu');
    expect(menuRes.status).toBe(200);
});

test('addMenuItem', async () => {
    let name = randomName();
    const addMenuItemRes = await request(app)
    .put('/api/order/menu')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
        title: name,
        description: name,
        image: name + '.png',
        price: 10.00,
    });
    expect(addMenuItemRes.status).toBe(200);
    expect(addMenuItemRes.body.some(item => item.title === name)).toBe(true);
});