/**
 * Onepanel
 * Onepanel API
 *
 * The version of the OpenAPI document: 0.18.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { KeyValue } from './keyValue';
import { WorkflowExecution } from './workflowExecution';


export interface CronWorkflow { 
    name?: string;
    uid?: string;
    manifest?: string;
    workflowExecution?: WorkflowExecution;
    labels?: Array<KeyValue>;
    namespace?: string;
}

