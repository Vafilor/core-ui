import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SimpleWorkflowDetail, WorkflowPhase, WorkflowService } from '../workflow.service';
import { NodeRenderer, NodeStatus } from '../../node/node.service';
import { DagComponent } from '../../dag/dag.component';
import { NodeInfoComponent } from '../../node-info/node-info.component';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { AceEditorComponent } from 'ng2-ace-editor';
import * as yaml from 'js-yaml';
import * as ace from 'brace';
import {
  AuthServiceService, CreateWorkflowExecutionBody,
  KeyValue,
  LabelServiceService, Metric,
  Parameter,
  WorkflowExecution,
  WorkflowServiceService
} from '../../../api';
import { MatDialog } from '@angular/material/dialog';
import { LabelEditDialogComponent } from '../../labels/label-edit-dialog/label-edit-dialog.component';
import { AppRouter } from '../../router/app-router.service';
import { ClockComponent } from '../../clock/clock.component';
import {
  ConfirmationDialogComponent,
} from '../../confirmation-dialog/confirmation-dialog.component';
import { WorkflowExecutionConstants } from '../models';
import { ParameterUtils } from '../../parameters/models';
import { Permissions } from '../../auth/models';
import { WorkflowExecuteDialogComponent } from '../workflow-execute-dialog/workflow-execute-dialog.component';
import { Alert } from '../../alert/alert';
import { AlertService } from '../../alert/alert.service';
import { PermissionService } from '../../permissions/permission.service';
import { MetricsEditDialogComponent } from '../../metrics/metrics-edit-dialog/metrics-edit-dialog.component';

const aceRange = ace.acequire('ace/range').Range;

@Component({
  selector: 'app-workflow',
  templateUrl: './workflow-view.component.html',
  styleUrls: ['./workflow-view.component.scss'],
  providers: [WorkflowService],
})
export class WorkflowViewComponent implements OnInit, OnDestroy {
  private snackbarRef: MatSnackBarRef<SimpleSnackBar>;

  @ViewChild('yamlEditor', {static: true}) yamlEditor: AceEditorComponent;
  @ViewChild(ClockComponent, {static: false}) clock: ClockComponent;
  @ViewChild(DagComponent, {static: false}) dag: DagComponent;

  // tslint:disable-next-line:variable-name
  private _nodeInfoElement: NodeInfoComponent;

  namespace: string;
  uid: string;
  workflow: SimpleWorkflowDetail;

  socket: WebSocket;

  nodeInfo?: NodeStatus;
  height = '1000px'; // Dummy large value.

  showNodeInfo = false;
  selectedNodeId = null;
  pendingSelectedNodeId = null;
  showLogs = false;
  showYaml = false;

  labels = new Array<KeyValue>();
  parameters = new Array<Parameter>();

  showAllParameters = false;

  loadingLabels = false;
  loadingMetrics = false;
  cloning = false;

  startedAt;
  finishedAt;
  permissions = new Permissions();

  backLinkName?: string;

  metrics: Metric[] = [];

  private socketClosedCount = 0;
  private socketErrorCount = 0;
  private markerId;

  @ViewChild('pageContent', {static: false}) set pageContent(value: ElementRef) {
    setTimeout( () => {
      // We (hackily) add 20px to account for padding/margin of elements, so we don't get a scroll.
      // We subtract 300 so we get a minimum height of 300px
      this.height = `calc(100vh - ${value.nativeElement.offsetTop + 20 - 300}px)`;
    }, 0);
  }
  @ViewChild(NodeInfoComponent, {static: false}) set nodeInfoElement(value: NodeInfoComponent) {
    if (!value) {
      return;
    }

    setTimeout( () => {
      this._nodeInfoElement = value;
    });
  }

  get dagIdentifier() {
    return {
      type: 'workflow',
      namespace: this.namespace,
      name: this.uid,
    };
  }

  constructor(
      private activatedRoute: ActivatedRoute,
      private alertService: AlertService,
      private authService: AuthServiceService,
      private permissionService: PermissionService,
      private workflowService: WorkflowService,
      private workflowServiceService: WorkflowServiceService,
      private apiWorkflowService: WorkflowServiceService,
      private labelService: LabelServiceService,
      private dialog: MatDialog,
      private appRouter: AppRouter,
      private snackbar: MatSnackBar,
      private router: Router,
  ) {
  }

  ngOnInit() {
    this.activatedRoute.paramMap.subscribe(next => {
      const namespace = next.get('namespace');
      this.setNamespaceUid(namespace, next.get('uid'));
      if (this.clock) {
        this.clock.reset(true);
      }

      this.showNodeInfo = false;
      this.selectedNodeId = null;
      this.showLogs = false;
      this.showYaml = false;
      this.startCheckingWorkflow();

      this.updateBackLink(namespace);
    });

    this.activatedRoute.queryParamMap.subscribe(next => {
      const nodeId = next.get('node');

      if (this.selectedNodeId === nodeId) {
        return;
      }

      this.pendingSelectedNodeId = nodeId;
    });
  }

  private getWorkflowTemplateParametersFromWorkflow(workflow: WorkflowExecution): Array<Parameter> {
    try {
      const workflowTemplateManifest = yaml.safeLoad(workflow.workflowTemplate.manifest);
      if (workflowTemplateManifest.arguments && workflowTemplateManifest.arguments.parameters) {
        return workflowTemplateManifest.arguments.parameters;
      }

      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  startCheckingWorkflow() {
    this.workflowServiceService.getWorkflowExecution(this.namespace, this.uid)
        .subscribe(res => {
          if (!res.metrics) {
            res.metrics = [];
          }

          this.metrics = res.metrics;

          this.workflow = new SimpleWorkflowDetail(res);

          this.getPermissions(res);

          this.labels = res.labels;

          const templateParameters = this.getWorkflowTemplateParametersFromWorkflow(res);
          this.parameters = ParameterUtils.combineValueAndTemplate(res.parameters, templateParameters);

          if (res.phase === 'Terminated') {
            this.workflow.phase = 'Terminated';
            this.startedAt = res.startedAt;
            this.finishedAt = res.finishedAt;
          }

          if (this.socket) {
            this.socket.close();
            this.socket = null;
          }

          this.socket = this.workflowService.watchWorkflow(this.namespace, this.uid);
          this.socket.onmessage = (event) => {
            this.onWorkflowExecutionUpdate(event.data);
          };

          this.socket.onerror = (err) => {
            this.socketErrorCount += 1;

            if (this.socketErrorCount < 2) {
              this.startCheckingWorkflow();
            }
          };

          this.socket.onclose = (msg) => {
            this.socketClosedCount += 1;

            if (this.socketClosedCount < 2) {
              this.startCheckingWorkflow();
            }
          };
        });
  }

  private getPermissions(workflowExecution: WorkflowExecution) {
    this.permissionService
        .getWorkflowPermissions(this.namespace, workflowExecution.uid, 'create', 'update', 'delete')
        .subscribe(res => {
          this.permissions = res;
        });
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.close();
    }

    if (this.snackbarRef) {
      this.snackbarRef.dismiss();
    }
  }

  setNamespaceUid(namespace: string, uid: string) {
    this.namespace = namespace;
    this.uid = uid;
  }

  onWorkflowExecutionUpdate(rawData: any) {
    if (!this.dag) {
      return;
    }

    let data;
    try {
      data = JSON.parse(rawData);
    } catch (e) {
      return;
    }

    if (!data.result) {
      return;
    }

    const oldPhase = this.workflow.phase;
    const wasTerminated = oldPhase === 'Terminated';
    this.workflow.updateWorkflowManifest(data.result.manifest);
    const newPhase = this.workflow.phase;

    this.onPhaseUpdate(oldPhase, newPhase);

    this.startedAt = this.workflow.workflowStatus.startedAt;
    this.finishedAt = this.workflow.workflowStatus.finishedAt;

    if (wasTerminated) {
      this.workflow.phase = 'Terminated';
    }

    const status = this.workflow.workflowStatus;

    // It is possible there is no node data yet. In which case, we can't display a dag.
    if (!status || !status.nodes) {
      return;
    }

    if (this.selectedNodeId && this.selectedNodeId !== this.workflow.name) {
      this.nodeInfo = status.nodes[this.selectedNodeId];

      if (this._nodeInfoElement) {
        this._nodeInfoElement.updateNodeStatus(this.nodeInfo);
      }
    }

    const graph = NodeRenderer.createGraphFromWorkflowStatus(status);
    this.dag.display(graph);

    if (this.pendingSelectedNodeId) {
      const nodeId = this.pendingSelectedNodeId;
      this.pendingSelectedNodeId = null;
      this.handleNodeClicked({
        nodeId
      });
      this.dag.selectNode(nodeId, true);
    }
  }

  handleNodeClicked(event: { nodeId: string}) {
    if (event.nodeId === this.workflow.name) {
      this.showNodeInfo = false;
      return;
    }

    const newNodeInfo = this.workflow.getNodeStatus(event.nodeId);
    if (!newNodeInfo) {
      return;
    }

    this.nodeInfo = newNodeInfo;

    this.showNodeInfo = true;

    if (this._nodeInfoElement) {
      this._nodeInfoElement.updateNodeStatus(this.nodeInfo);
      const templateParameters = this.workflow.getTemplateManifestParameters(newNodeInfo.templateName);
      this._nodeInfoElement.updateOutputParameters(templateParameters);
    }
    this.selectedNodeId = event.nodeId;

    this.showLogs = false;

    if (this.showYaml) {
      this.updateYamlSelection();
    }

    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        node: this.selectedNodeId,
      }
    });
  }

  onNodeInfoClosed() {
    this.nodeInfo = null;
    this.showNodeInfo = false;
  }

  onYamlClicked() {
    if (!this.workflow) {
      return;
    }

    if (!this.nodeInfo) {
      return;
    }

    this.showYaml = true;

    this.updateYamlSelection();
  }

  updateYamlSelection() {
    const spec = this.workflow.yamlManifest;
    const parsedYaml = yaml.safeLoad(spec);
    const templates = parsedYaml.templates;

    const templateNames = [];
    let selectedTemplate = null;
    for (const template of templates) {
      templateNames.push(template.name);
      if (template.name === this.nodeInfo.templateName) {
        selectedTemplate = template;
      }
    }

    const manifestLines = spec.split('\n');

    let templatesLineNumber = -1;
    let templatesIndentation = 0;
    for (let i = 0; i < manifestLines.length; i++) {
      const line = manifestLines[i];
      const templateIndex = line.indexOf('templates');
      if (templateIndex >= 0) {
        templatesLineNumber = i;
        templatesIndentation = templateIndex;
        break;
      }
    }

    let templateStartLineNumber = -1;
    let templateEndLineNumber = -1;
    let firstNameIndentation = -1;

    for (let i = templatesLineNumber; i < manifestLines.length; i++) {
      const line = manifestLines[i];

      const trimmedLine = line.trimLeft();
      if (trimmedLine.length === 0) {
        continue;
      }

      const indentation = line.length - trimmedLine.length;

      if (indentation < templatesIndentation) {
        break;
      }

      const nameIndex = line.indexOf('name');
      if (firstNameIndentation === -1 || (nameIndex < firstNameIndentation)) {
        firstNameIndentation = nameIndex;
      }

      if (templateStartLineNumber === -1 && nameIndex > 0 && nameIndex === firstNameIndentation) {
        if (line.indexOf(this.nodeInfo.templateName) >= 0) {
          templateStartLineNumber = i;
        }
        continue;
      }

      if (templateEndLineNumber === -1 && nameIndex > 0 && nameIndex <= firstNameIndentation ) {
        templateEndLineNumber = i - 1;
        break;
      }
    }

    if (templateStartLineNumber !== -1 && templateEndLineNumber === -1) {
      templateEndLineNumber = manifestLines.length;
    }

    const from = templateStartLineNumber;
    const to = templateEndLineNumber;


    if (this.markerId) {
      this.yamlEditor.getEditor().session.removeMarker(this.markerId);
    }

    this.markerId = this.yamlEditor.getEditor().session.addMarker(new aceRange(from, 0, to, 100), 'highlight', 'fullLine');
    this.yamlEditor.getEditor().scrollToLine(from, true, true, () => {});
  }

  onLogsClicked() {
    if (!this.nodeInfo) {
      return;
    }

    this.showLogs = true;
  }

  onLogsClosed() {
    this.showLogs = false;
  }

  onTerminate() {
    const dialog = this.dialog.open(ConfirmationDialogComponent, {
      data: WorkflowExecutionConstants.getConfirmTerminateDialogData(this.workflow.name),
    });

    dialog.afterClosed().subscribe(res => {
      if (!res) {
        return;
      }

      this.workflowServiceService.terminateWorkflowExecution(this.namespace, this.workflow.uid)
          .subscribe(() => {
            if (this.socket) {
              this.socket.close();
            }

            this.finishedAt = new Date();
            this.workflow.phase = 'Terminated';
            this.snackbarRef = this.snackbar.open('Workflow terminated', 'OK');
          }, err => {
            this.snackbarRef = this.snackbar.open('Unable to terminate workflow', 'OK');
          });
    });
  }

  onYamlClose() {
    this.showYaml = false;
  }

  onShowTotalYaml() {
    if (this.markerId) {
      this.yamlEditor.getEditor().session.removeMarker(this.markerId);
    }

    this.showYaml = true;
  }

  onEdit() {
    let labelsCopy = [];
    if (this.labels) {
      labelsCopy = this.labels.slice();
    }

    const dialogRef = this.dialog.open(LabelEditDialogComponent, {
      width: '500px',
      maxHeight: '100vh',
      data: {
        labels: labelsCopy
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (!data) {
        return;
      }

      this.loadingLabels = true;
      this.labelService.replaceLabels(this.namespace, 'workflow_execution', this.workflow.uid, {
        items: data
      }).subscribe(res => {
        this.labels = res.labels;
        this.loadingLabels = false;
      }, err => {
        this.loadingLabels = false;
      });
    });
  }

  onEditMetrics() {
    const dialogRef = this.dialog.open(MetricsEditDialogComponent, {
      width: '550px',
      maxHeight: '100vh',
      data: {
        metrics: this.metrics
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (!data) {
        return;
      }

      this.loadingMetrics = true;
      this.workflowServiceService.updateWorkflowExecutionMetrics(this.namespace, this.uid, {
        metrics: data
      }).subscribe(res => {
        if (!res.metrics) {
          res.metrics = [];
        }

        this.metrics = res.metrics;
        this.loadingMetrics = false;
      }, err => {
        this.loadingMetrics = false;
      });
    });
  }

  toggleShowParameters() {
    this.showAllParameters = !this.showAllParameters;
  }

  runAgain() {
    const dialogRef = this.dialog.open(WorkflowExecuteDialogComponent, {
      width: '60vw',
      maxHeight: '100vh',
      data: {
        namespace: this.namespace,
        parameters: this.parameters,
        labels: this.labels,
        workflowTemplate: this.workflow.workflowTemplate,
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) {
        return;
      }
      this.cloning = true;

      const request: CreateWorkflowExecutionBody = {
        workflowTemplateUid: this.workflow.workflowTemplate.uid,
        workflowTemplateVersion: this.workflow.workflowTemplate.version,
        parameters: result.workflowExecution.parameters,
        labels: result.workflowExecution.labels,
      };

      this.workflowServiceService.createWorkflowExecution(this.namespace, request)
          .subscribe(res => {
            this.appRouter.navigateToWorkflowExecution(this.namespace, res.name);
            this.cloning = false;
          }, err => {
            this.cloning = false;
            this.alertService.storeAlert(new Alert({
              message: 'Unable to clone workflow',
              type: 'danger'
            }));
          });
    });
  }

  updateBackLink(namespace: string) {
    const backLink = this.appRouter.getBackLink(namespace, {
      name: 'Back to workflows',
      route: `/${namespace}/workflows`,
    });

    this.backLinkName = backLink.name;
  }

  /**
   * goBack takes you back to the previous url, if any.
   */
  goBack(e: any) {
    if (e) {
      e.preventDefault();
    }

    if (!this.appRouter.goBack()) {
      this.appRouter.navigateToWorkflowsExecutions(this.namespace);
    }
  }

  onPhaseUpdate(oldPhase: WorkflowPhase, newPhase: WorkflowPhase) {
    if (oldPhase === newPhase) {
      return;
    }

    // When a workflow finishes, metrics may have been updated along the way.
    // make sure to fetch the latest metrics so UI is up to date.
    switch (newPhase) {
      case 'Error':
      case 'Failed':
      case 'Terminated':
      case 'Succeeded':
        this.workflowServiceService.getWorkflowExecution(this.namespace, this.uid).subscribe(res => {
          if (!res.metrics) {
            res.metrics = [];
          }
          this.metrics = res.metrics;
        });
    }
  }

}
