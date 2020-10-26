/**
 * Onepanel
 * Onepanel API
 *
 * The version of the OpenAPI document: 0.15.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export interface WorkspaceStatisticReport { 
    total?: number;
    lastCreated?: string;
    launching?: number;
    running?: number;
    updating?: number;
    pausing?: number;
    paused?: number;
    terminating?: number;
    terminated?: number;
    failedToPause?: number;
    failedToResume?: number;
    failedToTerminate?: number;
    failedToLaunch?: number;
    failedToUpdate?: number;
    failed?: number;
}

