/**
 * Onepanel
 * Onepanel API
 *
 * The version of the OpenAPI document: 0.12.0b4
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { Service } from './service';


export interface ListServicesResponse { 
    count?: number;
    services?: Array<Service>;
    page?: number;
    pages?: number;
    totalCount?: number;
}

