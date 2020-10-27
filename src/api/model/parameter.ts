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
import { ParameterOption } from './parameterOption';


export interface Parameter { 
    name?: string;
    value?: string;
    type?: string;
    displayName?: string;
    hint?: string;
    required?: boolean;
    visibility?: string;
    options?: Array<ParameterOption>;
}

