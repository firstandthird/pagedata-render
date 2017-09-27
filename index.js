const nunjucks = require('nunjucks');
const async = require('async');
const fs = require('fs');
const PageData = require('pagedata');
const objoin = require('objoin');
const path = require('path');
const mkdirp = require('mkdirp');

class PagedataRenderer {
  constructor(key, options) {
    this.options = options;
    this.userAgent = options.userAgent || `pagedataRenderer/${require('./package.json').version}`;
    this.pagedata = new PageData(options.host, key, this.userAgent);
    this.status = options.status || 'draft';
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

  fetch(pageSlug, allDone) {
    const map = Object.assign({}, this.options.common || {});
    if (pageSlug) {
      map.content = pageSlug;
    }
    const status = this.status;
    async.mapValues(map, (value, key, next) => {
      this.pagedata.getPage(value, { status }, (err, pageData) => {
        if (err) {
          return next(err);
        }
        next(null, pageData.content);
      });
    }, allDone);
  }

  renderPage(pageSlug, templateFile, allDone) {
    const render = this.render.bind(this);
    const fetch = this.fetch.bind(this);
    async.autoInject({
      data(done) {
        fetch(pageSlug, done);
      },
      render(data, done) {
        render(templateFile, data, done);
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
    const fetch = this.fetch.bind(this);
    const status = this.status;
    async.autoInject({
      commonData(done) {
        fetch(null, done);
      },
      childPages(done) {
        pagedata.getPages({ parentPageSlug: collectionSlug, populate: 'content', status }, done);
      },
      renderAll(childPages, commonData, done) {
        objoin(childPages, { key: 'content', set: 'html' }, (content, next) => {
          const data = Object.assign({}, commonData);
          data.content = content;
          render(templateFile, data, next);
        }, done);
      },
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

  renderAndSave(projectSlug, templatePath, outputPath, allDone) {
    const render = this.render.bind(this);
    const pagedata = this.pagedata;
    pagedata.getPages({ projectSlug, populate: 'content' }, (err, childPages) => {
      if (err) {
        return allDone(err);
      }
      async.each(childPages, (page, eachDone) => {
        // skip collections for now:
        if (page.type === 'collection') {
          return eachDone();
        }
        async.autoInject({
          paths(done) {
            const root = page.slug.replace(`${projectSlug}-`, '');
            page.inputPath = path.join(templatePath, `${root}.njk`);
            page.outputPath = (page.slug === `${projectSlug}-homepage`) ? path.join(outputPath, 'index.html') :
                path.join(outputPath, page.slug.replace(`${projectSlug}-`, ''), 'index.html');
            done();
          },
          mkdirs(paths, done) {
            if (page.outputPath === path.join(outputPath, 'index.html')) {
              mkdirp(outputPath, {}, done);
            } else {
              mkdirp(path.dirname(page.outputPath), {}, done);
            }
          },
          renderAll(mkdirs, done) {
            render(page.inputPath, { content: page.content }, (renderErr, htmlString) => {
              if (renderErr) {
                return done(renderErr);
              }
              fs.writeFile(page.outputPath, htmlString, done);
            });
          },
        }, eachDone);
      }, allDone);
    });
  }
}

module.exports = PagedataRenderer;
