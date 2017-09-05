const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');
const PageData = require('pagedata');

class PagedataRenderer {
  constructor(key, options) {
    this.options = options;
    this.userAgent = options.userAgent || `pagedataRenderer/${require('./package.json').version}`;
    this.pagedata = new PageData(options.host, key, this.userAgent);
  }

  render(filePath, data, allDone) {
    const options = this.options;
    async.autoInject({
      text(done) {
        fs.readFile(filePath, done);
      },
      env(done) {
        return done(null, new nunjucks.Environment(new nunjucks.FileSystemLoader(options.path)));
      },
      render(text, env, done) {
        const renderer = nunjucks.compile(text.toString(), env);
        return done(null, renderer.render(data));
      }
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, result.render);
    });
  }

  renderPage(pageSlug, templateFile, allDone) {
    const render = this.render.bind(this);
    const pagedata = this.pagedata;
    async.autoInject({
      page(done) {
        pagedata.getPage(pageSlug, done);
      },
      render(page, done) {
        render(templateFile, { content: page }, done);
      },
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      return allDone(null, result.render);
    });
  }

  renderCollection(collectionSlug, templateFile, allDone) {
    const render = this.render.bind(this);
    const pagedata = this.pagedata;
    async.autoInject({
      childPages(done) {
        pagedata.getPages({ parentPageSlug: collectionSlug }, done);
      },
      renderAll(childPages, done) {
        async.each(childPages, (page, eachDone) => {
          render(templateFile, { content: page }, (err, html) => {
            if (err) {
              return eachDone(err);
            }
            page.html = html;
            return eachDone();
          });
        }, done);
      }
    }, (err, result) => {
      if (err) {
        return allDone(err);
      }
      const reduction = {};
      result.childPages.forEach((page) => {
        reduction[page.slug] = page.html;
      });
      return allDone(null, reduction);
    });
  }
}

module.exports = PagedataRenderer;
