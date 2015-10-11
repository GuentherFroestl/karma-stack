/**
 * Module dependencies.
 */

var koa = require('koa');
var serve = require('koa-static');
var koaRouter = require('koa-router');
var logger = require('koa-logger');
var koaBody   = require('koa-body')
var assert = require('assert');
var json = require('koa-json');
var mongoDB = require('mongodb');
var MongoObjectID = mongoDB.ObjectID
var MongoClient = mongoDB.MongoClient;
var paramify = require('koa-params');



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
    var bodyParser =koaBody();
    var router = koaRouter();

    app.use(logger());
    app.use(json());
    app.use(serve(__dirname + '/public'));
    app.use(bodyParser);
    router.param('collectionName', setDBAndCollectionForRequest);
    router.get('/:collectionName', findAllObjects);
    router.get('/:collectionName/:id', findObjectById);
    router.post('/:collectionName',saveObject);
    router.put('/:collectionName',updateObject);
    router.del('/:collectionName/:id', deleteObjectById);
    app.use(router.routes());


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
    function* findAllObjects(next) {
        assert(this.mongoCollection, 'mongo collection required');
        var limit = 99999;
        var skip = 0;
        if (this.skipRecords){
            skip=Number(this.skipRecords);
        }
        if (this.limitRecords){
            limit=Number(this.limitRecords);
        }
        console.log('findAll collection:','skip:',skip,'limit:',limit);

        // Peform a simple find and return all the documents
        this.body = yield this.mongoCollection.find().skip(skip).limit(limit).toArray();
        yield next;
    }

    function* findObjectById(next){
        assert(this.params.id, 'param id must be set in the path');
        console.log('find object:',this.params.id);
        this.body = this.params.id;
        yield next;
    }

    function* deleteObjectById(next){
        assert(this.params.id, 'param id must be set in the path');
        console.log('delete object:',this.params.id);
        this.body = this.params.id;
        yield next;
    }

    function* saveObject(next){
        assert(this.mongoCollection, 'mongo collection required');
        var objectID = new MongoObjectID();
        console.log('request object:',this.request.body,objectID);
        this.request.body._id=objectID;
        var obj = this.request.body;
        console.log('persist object',this.request.body);
        var res=yield this.mongoCollection.insertOne(this.request.body);
        this.body = this.request.body;
        yield next;
    }

    function* updateObject(next){
        assert(this.mongoCollection, 'mongo collection required');
        console.log('persist object:',this.request.body);
        this.body = this.request.body;
        yield next;
    }

    return app;
};

