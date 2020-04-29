/**
 * Onepanel Core
 * Onepanel Core project API
 *
 * The version of the OpenAPI document: 1.0.0-beta1
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
    schedule?: string;
    timezone?: string;
    suspend?: boolean;
    concurrencyPolicy?: string;
    startingDeadlineSeconds?: string;
    successfulJobsHistoryLimit?: number;
    failedJobsHistoryLimit?: number;
    workflowExecution?: WorkflowExecution;
    labels?: Array<KeyValue>;
}

