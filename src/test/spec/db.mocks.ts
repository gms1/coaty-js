/*! Copyright (c) 2018 Siemens AG. Licensed under the MIT License. */

import { Observable } from "rxjs";
import { filter } from "rxjs/operators";

import { QueryEvent, RetrieveEvent } from "../../com";
import { Controller } from "../../controller";
import { DbContext } from "../../db";
import { CoatyObject, ObjectFilter, ObjectJoinCondition } from "../../model";

export const OBJECT_TYPE_NAME_DB_TEST_OBJECT = "coaty.test.DbTestObject";

export interface DbTestObject extends CoatyObject {
    testId: number;
    testValue: any;
    testText: string;
    testBool: boolean;
    testUpdate?: string;
}

export class MockQueryingController extends Controller {

    query(objectFilter: ObjectFilter, objectJoinConditions: ObjectJoinCondition[]): Observable<RetrieveEvent> {
        return this.communicationManager
            .publishQuery(QueryEvent.withObjectTypes(
                this.identity,
                [OBJECT_TYPE_NAME_DB_TEST_OBJECT],
                objectFilter,
                objectJoinConditions));
    }
}

export class DbTestObjectManagementController extends Controller {

    onInit() {
        super.onInit();
        this._handleQueryEvents();
    }

    private _handleQueryEvents() {
        this.communicationManager
            .observeQuery(this.identity)
            .pipe(filter(event => event.eventData.isObjectTypeCompatible(OBJECT_TYPE_NAME_DB_TEST_OBJECT)))
            .subscribe(event => {
                this._retrieveTestObjects(event);
            });
    }

    private _retrieveTestObjects(event: QueryEvent) {
        const connectionInfo = this.runtime.databaseOptions["testdb"];
        const dbContext = new DbContext(connectionInfo);
        const objectFilter = event.eventData.objectFilter;
        const joinConditions = dbContext.getDbJoinConditionsFrom(event.eventData.objectJoinConditions,
            {
                localProperty: "testId",
                fromCollection: "testobjects",
                fromProperty: "testId",
            },
            {
                localProperty: "externalId",
                fromCollection: "testobjects",
                fromProperty: "externalId",
            },
            {
                localProperty: "testValue",
                fromCollection: "testobjects",
                fromProperty: "testId",
            });

        dbContext
            .findObjects<DbTestObject>("testobjects", objectFilter, joinConditions)
            .then(iterator => iterator.forBatch(batch => {
                event.retrieve(RetrieveEvent.withObjects(this.identity, batch));
            }))
            .catch(error => {
                // In case of retrieval error, do not respond with a Retrieve event.
                // In a production system the query sender should 
                // implement proper error handling by using a timeout operator
                // that triggers in case no response 
                // is received after a certain period of time.
                // As an example, see it-spec named 
                // "Objects are queried by Query-Retrieve event pattern"
                // in file test/spec/db-nosql.spec.ts.
                // console.log("Query-Retrieve error: " + error);
            });
    }

}
