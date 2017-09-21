const tap = require('tap');
const PagedataRenderer = require('../index.js');
const path = require('path');
const async = require('async');
const Hapi = require('hapi');
const PageData = require('pagedata');

const templateFile = path.join(__dirname, 'fixture', 'page1.njk');

tap.test('can initiate the class', (t) => {
  const pr = new PagedataRenderer('apiKey', { host: 'http://localhost:8081', userAgent: 'pagedataRenderer/1' });
  t.equal(pr instanceof PagedataRenderer, true);
  t.equal(pr.options.host, 'http://localhost:8081');
  t.equal(pr.options.userAgent, 'pagedataRenderer/1');
  t.equal(pr.pagedata instanceof PageData, true);
  t.end();
});

tap.test('fetch', (t) => {
  const pr = new PagedataRenderer('apiKey', {
    path: __dirname,
    host: 'http://localhost:8081'
  });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/api/pages/page-slug',
        method: 'get',
        handler(request, reply) {
          return reply(null, { content: { text: 'Hello World' } });
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.fetch('page-slug', (err, result) => {
        t.equal(err, null);
        t.deepEqual(result, { content: { text: 'Hello World' } });
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});

tap.test('fetch with common', (t) => {
  const pr = new PagedataRenderer('apiKey', {
    path: __dirname,
    host: 'http://localhost:8081',
    common: {
      header: 'site-header'
    }
  });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/api/pages/page-slug',
        method: 'get',
        handler(request, reply) {
          return reply(null, { content: { text: 'Hello World' } });
        }
      });
      server.route({
        path: '/api/pages/site-header',
        method: 'get',
        handler(request, reply) {
          return reply(null, { content: { logo: 'awesome' } });
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.fetch('page-slug', (err, result) => {
        t.equal(err, null);
        t.deepEqual(result, {
          header: {
            logo: 'awesome'
          },
          content: {
            text: 'Hello World'
          }
        });
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});

tap.test('render', (t) => {
  const pr = new PagedataRenderer('apiKey', { path: __dirname });
  pr.render(templateFile, { content: { text: 'Hello World' } }, (err, result) => {
    t.equal(err, null);
    t.notEqual(result.indexOf('Hello World'), -1);
    t.end();
  });
});

tap.test('renderPage', (t) => {
  const pr = new PagedataRenderer('apiKey', { path: __dirname, host: 'http://localhost:8081' });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/api/pages/page-slug',
        method: 'get',
        handler(request, reply) {
          return reply(null, { content: { text: 'Hello World' } });
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.renderPage('page-slug', templateFile, (err, result) => {
        t.equal(err, null);
        t.notEqual(result.indexOf('Hello World'), -1);
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});


tap.test('renderCollection', (t) => {
  const pr = new PagedataRenderer('apiKey', { path: __dirname, host: 'http://localhost:8081' });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/api/pages',
        method: 'get',
        handler(request, reply) {
          t.equal(request.query.parentPageSlug, 'collection-slug');
          t.equal(request.query.populate, 'content');
          return reply(null, [
            { slug: 'page1-slug', content: { text: 'Hello World 1' } },
            { slug: 'page2-slug', content: { text: 'Hello World 2' } },
          ]);
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.renderCollection('collection-slug', templateFile, (err, result) => {
        t.equal(err, null);
        t.notEqual(result['page1-slug'].indexOf('Hello World 1'), -1);
        t.notEqual(result['page2-slug'].indexOf('Hello World 2'), -1);
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});


tap.test('renderCollection with common', (t) => {
  const templateFile2 = path.join(__dirname, 'fixture', 'commonPage.njk');
  const pr = new PagedataRenderer('apiKey', {
    path: __dirname,
    host: 'http://localhost:8081',
    common: {
      header: 'website-header'
    }
  });
  async.autoInject({
    server(done) {
      const server = new Hapi.Server();
      server.connection({
        host: 'localhost',
        port: 8081
      });
      server.route({
        path: '/api/pages',
        method: 'get',
        handler(request, reply) {
          t.equal(request.query.parentPageSlug, 'collection-slug');
          t.equal(request.query.populate, 'content');
          return reply(null, [
            { slug: 'page1-slug', content: { text: 'Hello World 1' } },
            { slug: 'page2-slug', content: { text: 'Hello World 2' } },
          ]);
        }
      });
      server.route({
        path: '/api/pages/website-header',
        method: 'get',
        handler(request, reply) {
          return reply(null, { content: { logo: 'awesome' } });
        }
      });
      server.start(() => done(null, server));
    },
    call(server, done) {
      pr.renderCollection('collection-slug', templateFile2, (err, result) => {
        t.equal(err, null);
        t.notEqual(result['page1-slug'].indexOf('awesomeHello World 1'), -1);
        t.notEqual(result['page2-slug'].indexOf('awesomeHello World 2'), -1);
        done();
      });
    },
    stop(server, call, done) {
      server.stop(done);
    }
  }, t.end);
});
