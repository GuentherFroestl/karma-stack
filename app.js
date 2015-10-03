/**
 * Module dependencies.
 */

var koa = require('koa');
var serve = require('koa-static');
var route = require('koa-route');
var logger = require('koa-logger');
var parse = require('co-body');
var assert = require('assert');
var json = require('koa-json');
var MongoClient = require('mongodb').MongoClient;
var paramify = require('koa-params');

route = paramify(route);
/**
 * Route shortcuts.
 */

var get = route.get;
var post = route.post;
var put = route.put;

/**
 *
 * @param db
 * @returns {koaApp}
 */

module.exports = function (db) {
    assert(db, 'db URL required');


    /**
     * Koa app.
     */

    var mongoDB;  //Will be set by the DB init
    //ontime per app
    initDB(db);


    var app = koa();

    app.use(logger());
    app.use(json());
    app.use(serve(__dirname + '/public'));
    route.param('collectionName', setDBAndCollectionForRequest);
    app.use(get('/:collectionName', findAll));


    /**
     * shutdown handler.
     */
    require('shutdown-handler').on('exit', function () {
        console.log("Shutdown MongoDB...");
        if (mongoDB) {
            mongoDB.close();
        }
    });
    /**
     * Set db for application
     * @param db URL
     */
    function initDB(db) {
        console.log('use db URL', db);
        assert(db, 'db URL required');
        MongoClient.connect(db).then(
            function (result) {
                console.log('MongoDB successful connected on URL', db);
                mongoDB = result;
            },
            function (error) {
                console.log('error', error);
            });
    }

    /**
     * set the collection name defined by the pathparameter into the request
     * @param collName
     * @param next
     */
    function* setDBAndCollectionForRequest(collName, next) {
        assert(mongoDB, 'db object required');
        assert(collName, 'collectionName required');
        this.mongoDb = mongoDB;
        console.log('CollectionName:', collName);
        this.collectionName = collName;
        this.mongoCollection = this.mongoDb.collection(this.collectionName);
        console.log('query:',this.query);
        if (this.query.skip){
            this.skipRecords=this.query.skip;
        }
        if (this.query.limit){
            this.limitRecords=this.query.limit;
        }
        yield next;
    }

    /**
     * find all entries in the collection defined by the request.
     */
    function* findAll() {
        assert(this.mongoDb, 'db object required');
        assert(this.collectionName, 'collection name required');
        var limit = 99999;
        var skip = 0;
        if (this.skipRecords){
            skip=Number(this.skipRecords);
        }
        if (this.limitRecords){
            limit=Number(this.limitRecords);
        }
        console.log('findAll collection:',this.collectionName,'skip:',skip,'limit:',limit);

        // Peform a simple find and return all the documents
        this.body = yield this.mongoCollection.find().skip(skip).limit(limit).toArray();
    }

    return app;
};

