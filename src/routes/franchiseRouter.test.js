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

let adminUser, testUser, testUserAuthToken, testUserId;

beforeAll(async () => {
    adminUser = await createAdminUser();
    testUser = { name: adminUser.name, email: adminUser.email, password: adminUser.password };
    const loginRes = await request(app).put('/api/auth').send(testUser);
    testUserAuthToken = loginRes.body.token;
    testUserId = loginRes.body.user.id;
});

afterAll(async () => {
    const connection = await DB.getConnection();
    connection.end();
});

test('getFranchise', async () => {
    const franchiseRes = await request(app).get('/api/franchise').send(testUser);
    expect(franchiseRes.status).toBe(200);
});

test('getUserFranchises', async () => {
    const userFranchisesRes = await request(app).get('/api/franchise/' + testUserId).set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(userFranchisesRes.status).toBe(200);
});

test('createFranchise', async () => {
    let name = randomName();
    const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      name: name,
      admins: [{ email: testUser.email }],
    });
    expect(createFranchiseRes.status).toBe(200);
    expect(createFranchiseRes.body.name).toBe(name);
});

test('deleteFranchise', async () => {
    let name = randomName();
    const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      name: name,
      admins: [{ email: testUser.email }],
    });
    expect(createFranchiseRes.status).toBe(200);
    expect(createFranchiseRes.body.name).toBe(name);

    const deleteFranchiseRes = await request(app)
    .delete('/api/franchise/' + createFranchiseRes.body.id)
    .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteFranchiseRes.status).toBe(200);
    expect(deleteFranchiseRes.body).toMatchObject({ message: 'franchise deleted' });
});

test('createStore', async () => {
    let name = randomName();
    const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      name: name,
      admins: [{ email: testUser.email }],
    });
    expect(createFranchiseRes.status).toBe(200);
    expect(createFranchiseRes.body.name).toBe(name);

    const createStoreRes = await request(app)
    .post('/api/franchise/' + createFranchiseRes.body.id + '/store')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({ name: name });
    expect(createStoreRes.status).toBe(200);
    expect(createStoreRes.body.name).toBe(name);
});

test('deleteStore', async () => {
    let name = randomName();
    const createFranchiseRes = await request(app)
    .post('/api/franchise')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({
      name: name,
      admins: [{ email: testUser.email }],
    });
    expect(createFranchiseRes.status).toBe(200);
    expect(createFranchiseRes.body.name).toBe(name);

    const createStoreRes = await request(app)
    .post('/api/franchise/' + createFranchiseRes.body.id + '/store')
    .set('Authorization', `Bearer ${testUserAuthToken}`)
    .send({ name: name });
    expect(createStoreRes.status).toBe(200);
    expect(createStoreRes.body.name).toBe(name);

    const deleteStoreRes = await request(app)
    .delete('/api/franchise/' + createFranchiseRes.body.id + '/store/' + createStoreRes.body.id)
    .set('Authorization', `Bearer ${testUserAuthToken}`);
    expect(deleteStoreRes.status).toBe(200);
    expect(deleteStoreRes.body).toMatchObject({ message: 'store deleted' });
});

