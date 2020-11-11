import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as yaml from 'js-yaml';
import { WorkflowTemplateDetail } from '../workflow-template/workflow-template.service';
import { NodeStatus } from '../node/node.service';
import { map } from "rxjs/operators";
import { environment } from "../../environments/environment";
import { AuthService } from "../auth/auth.service";
import { WorkflowExecution as ApiWorkflowExecution, WorkflowTemplate } from "../../api";

export interface Workflow {
  uid: string;
  createdAt: string;
  startedAt: string;
  finishedAt?: string;
  name: string;
  manifest?: string;
  phase?: string;
}

// https://github.com/argoproj/argo/issues/1849#issuecomment-565640866
export type WorkflowPhase = 'Pending' | 'Running' | 'Succeeded' | 'Skipped' | 'Failed' | 'Error' | 'Terminated';

export interface WorkflowStatus {
  phase: WorkflowPhase;
  startedAt: string;
  finishedAt: string;
  nodes: {string: NodeStatus};
}

export interface WorkflowManifest {
  spec: any;
  status: WorkflowStatus;
}

export class SimpleWorkflowDetail {
  static activePhases = {
    'Pending': true,
    'Running': true
  };

  private jsonManifest: WorkflowManifest|null = null;

  uid: string;
  createdAt: string;
  name: string;
  manifest?: string;
  yamlManifest?: string;
  workflowTemplate: WorkflowTemplate;
  _phase: WorkflowPhase;

  constructor(workflow: ApiWorkflowExecution) {
    this.uid = workflow.uid;
    this.createdAt = workflow.createdAt;
    this.name = workflow.name;
    this.manifest = workflow.manifest;
    this.workflowTemplate = workflow.workflowTemplate;

    if(this.manifest) {
      this.updateWorkflowManifest(this.manifest);
    }
  }

  get workflowStatus(): WorkflowStatus|null {
    if(!this.jsonManifest) {
      return null;
    }
    
    return this.jsonManifest.status;
  }

  set phase(value: WorkflowPhase) {
    this._phase = value;
  }

  get phase(): WorkflowPhase|null {
    if(this._phase) {
      return this._phase;
    }

    if(!this.jsonManifest) {
      return null;
    }

    return this.jsonManifest.status.phase;
  }

  get active(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return SimpleWorkflowDetail.activePhases[phase];
  }

  get succeeded(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return this.phase === 'Succeeded';
  }

  get terminated(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return this.phase === 'Terminated';
  }

  updateWorkflowManifest(manifest: string) {
    this.jsonManifest = JSON.parse(manifest);

    let jsonTemplateManifest = yaml.safeLoad(this.workflowTemplate.manifest);
    if (this.jsonManifest.spec.arguments && this.jsonManifest.spec.arguments.parameters) {
      if(!jsonTemplateManifest.arguments) {
        jsonTemplateManifest.arguments = {};
      }

      jsonTemplateManifest.arguments.parameters = this.jsonManifest.spec.arguments.parameters;
    }
    this.yamlManifest = yaml.safeDump(jsonTemplateManifest, {
      lineWidth: Number.MAX_SAFE_INTEGER, // We don't want to restrict on width.
    });
  }

  getNodeStatus(nodeId: string): NodeStatus|null {
    const status = this.workflowStatus;
    if(!status) {
      return null;
    }

    return status.nodes[nodeId];
  }

  getTemplateManifestParameters(name: string) {
    const templates = this.jsonManifest.spec.templates;
    for(const template of templates) {
      if(template.name === name) {
        return template.outputs.parameters;
      }
    }

    return null;
  }
}

// todo deprecated. Remove this and use API generated WorkflowExecution.
export class WorkflowExecution {
  uid: string;
  createdAt: string;

  startedAt: string;
  finishedAt: string|Date;

  name: string;
  phase?: string;

  private jsonManifest: WorkflowManifest|null = null;

  constructor(workflow: Workflow) {
    this.uid = workflow.uid;
    this.createdAt = workflow.createdAt;
    this.startedAt = workflow.createdAt;
    this.finishedAt = workflow.finishedAt;
    this.name = workflow.name;
    this.phase = workflow.phase;
  }

  get active(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return SimpleWorkflowDetail.activePhases[phase];
  }

  get succeeded(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return this.phase === 'Succeeded';
  }

  get terminated(): boolean {
    const phase = this.phase;
    if(!phase) {
      return false;
    }

    return this.phase === 'Terminated';
  }

  updateWorkflowManifest(manifest: string) {
    this.jsonManifest = JSON.parse(manifest);
    const status = this.jsonManifest.status;

    this.startedAt = status.startedAt;
    this.finishedAt = status.finishedAt;
    this.phase = status.phase;
  }


  get workflowStatus(): WorkflowStatus|null {
    if(!this.jsonManifest) {
      return null;
    }

    return this.jsonManifest.status;
  }
}

@Injectable()
export class WorkflowService {
  watchWorkflow(namespace: string, name: string) {
    const url =`${environment.baseWsUrl}/apis/v1beta1/${namespace}/workflow_executions/${name}/watch`;

    return new WebSocket(url);
  }

  watchLogs(namespace: string, workflowName: string, podId: string, containerName = 'main') {
    const url =`${environment.baseWsUrl}/apis/v1beta1/${namespace}/workflow_executions/${workflowName}/pods/${podId}/containers/${containerName}/logs`;

    return new WebSocket(url);
  }
}

