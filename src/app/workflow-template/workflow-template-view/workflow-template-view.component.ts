import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { WorkflowTemplateService } from '../workflow-template.service';
import { DagComponent } from '../../dag/dag.component';
import { NodeRenderer } from '../../node/node.service';
import {
    WorkflowService
} from '../../workflow/workflow.service';
import { MatTabChangeEvent } from '@angular/material';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { WorkflowExecuteDialogComponent } from '../../workflow/workflow-execute-dialog/workflow-execute-dialog.component';
import { PageEvent } from '@angular/material/paginator';
import { ConfirmationDialogComponent } from '../../confirmation-dialog/confirmation-dialog.component';
import { AlertService } from '../../alert/alert.service';
import { Alert } from '../../alert/alert';
import {
    CreateWorkflowExecutionBody,
    CronWorkflow,
    CronWorkflowServiceService,
    KeyValue, ListCronWorkflowsResponse,
    WorkflowServiceService, WorkflowTemplate, WorkflowTemplateServiceService
} from '../../../api';
import { MatTabGroup } from '@angular/material/tabs';
import { AppRouter } from '../../router/app-router.service';
import { Pagination } from '../../requests/pagination';
import { WorkflowExecutionsChangedEvent } from '../../workflow/workflow-executions/workflow-executions.component';

type WorkflowTemplateViewState = 'initialization' | 'new' | 'executing' | 'failed-to-load';

@Component({
    selector: 'app-workflow-template-view',
    templateUrl: './workflow-template-view.component.html',
    styleUrls: ['./workflow-template-view.component.scss'],
    providers: [WorkflowService, WorkflowTemplateService]
})
export class WorkflowTemplateViewComponent implements OnInit {
    private dagComponent: DagComponent;

    @ViewChild(DagComponent, {static: false}) set dag(value: DagComponent) {
        this.dagComponent = value;
        this.showDag();
    }

    get dag(): DagComponent {
        return this.dagComponent;
    }

    @ViewChild(MatTabGroup, {static: false}) matTabGroup: MatTabGroup;

    manifestText: string;
    namespace: string;
    uid: string;
    state: WorkflowTemplateViewState = 'initialization';

    cronWorkflowResponse: ListCronWorkflowsResponse;
    cronWorkflows: CronWorkflow[] = [];
    workflowPagination = new Pagination();
    cronWorkflowPagination = new Pagination();

    // tslint:disable-next-line:variable-name
    private _hasWorkflowExecutions = false;
    set hasWorkflowExecutions(value: boolean) {
        this._hasWorkflowExecutions = value;

        this.updateShowWorkflowExecutionCallToAction();
    }

    get hasWorkflowExecutions(): boolean {
        return this._hasWorkflowExecutions;
    }

    // tslint:disable-next-line:variable-name
    private _hasCronWorkflows = false;
    set hasCronWorkflows(value: boolean) {
        this._hasCronWorkflows = value;

        this.updateShowCronWorkflowsCallToAction();
    }

    get hasCronWorkflows(): boolean {
        return this._hasCronWorkflows;
    }

    labels = new Array<KeyValue>();
    showWorkflowExecutionsCallToAction = false;
    showCronWorkflowsCallToAction = false;

    backLinkName?: string;

    // @todo rename
    private workflowTemplateDetail: WorkflowTemplate;

    get workflowTemplate(): WorkflowTemplate {
        return this.workflowTemplateDetail;
    }

    set workflowTemplate(value: WorkflowTemplate) {
        this.workflowTemplateDetail = value;
        this.manifestText = value.manifest;
        this.showDag();
    }

    constructor(
        private snackBar: MatSnackBar,
        private router: Router,
        private appRouter: AppRouter,
        private activatedRoute: ActivatedRoute,
        private workflowService: WorkflowService,
        private cronWorkflowService: CronWorkflowServiceService,
        private workflowServiceService: WorkflowServiceService,
        private workflowTemplateService: WorkflowTemplateService,
        private workflowTemplateServiceService: WorkflowTemplateServiceService,
        private dialog: MatDialog,
        private alertService: AlertService,
    ) {
    }

    ngOnInit() {
        this.activatedRoute.paramMap.subscribe(next => {
            this.state = 'initialization';
            this.namespace = next.get('namespace');
            this.uid = next.get('uid');

            this.getWorkflowTemplate();
            this.getCronWorkflows();
            this.updateBackLink(this.namespace);
        });
    }

    getWorkflowTemplate() {
        this.workflowTemplateServiceService.getWorkflowTemplate(this.namespace, this.uid)
            .subscribe(res => {
                this.workflowTemplate = res;
                this.labels = res.labels;
                this.state = 'new';
            }, err => {
                this.state = 'failed-to-load';
            });
    }

    workflowsChanged(event: WorkflowExecutionsChangedEvent) {
        this.hasWorkflowExecutions = event.hasAnyWorkflows;
    }

    executeWorkflow(e?: any, cron: boolean = false) {
        if (e) {
            e.preventDefault();
        }

        const dialogRef = this.dialog.open(WorkflowExecuteDialogComponent, {
            width: '60vw',
            maxHeight: '100vh',
            data: {
                namespace: this.namespace,
                workflowTemplate: this.workflowTemplate,
                cron,
            }
        });

        dialogRef.afterClosed().subscribe(result => {
            if (!result) {
                return;
            }

            if (result.cron) {
                result.workflowExecution.workflowTemplate = this.workflowTemplate;

                const request: CronWorkflow = {
                    manifest: result.cron.manifest,
                    workflowExecution: result.workflowExecution,
                    labels: result.workflowExecution.labels,
                };

                this.executeCronWorkflowRequest(request);

            } else {
                const request: CreateWorkflowExecutionBody = {
                    workflowTemplateUid: this.workflowTemplate.uid,
                    parameters: result.workflowExecution.parameters,
                    labels: result.workflowExecution.labels,
                };

                this.executeWorkflowRequest(request);
            }
        });
    }

    protected executeWorkflowRequest(request: CreateWorkflowExecutionBody) {
        this.state = 'executing';
        this.workflowServiceService.createWorkflowExecution(this.namespace, request)
            .subscribe(res => {
                this.appRouter.navigateToWorkflowExecution(this.namespace, res.name);
            }, err => {
                this.state = 'new';
                this.alertService.storeAlert(new Alert({
                    message: 'Unable to execute workflow',
                    type: 'danger'
                }));
            });
    }

    protected executeCronWorkflowRequest(data: CronWorkflow) {
        this.state = 'executing';

        this.cronWorkflowService.createCronWorkflow(this.namespace, data)
            .subscribe(res => {
                this.getCronWorkflows();
                this.matTabGroup.selectedIndex = 1;
                this.alertService.storeAlert(new Alert({
                    message: `You have scheduled "${res.name}"`,
                    type: 'success'
                }));
                this.state = 'new';
            }, err => {
                this.state = 'new';
            });
    }

    showDag() {
        if (!this.dag) {
            return;
        }

        try {
            const g = NodeRenderer.createGraphFromManifest(this.workflowTemplateDetail.manifest);
            this.dag.display(g);
        } catch (e) {
            console.error(e);
        }
    }

    onTabChange(event: MatTabChangeEvent) {
        this.updateShowWorkflowExecutionCallToAction();
        this.updateShowCronWorkflowsCallToAction();
    }

    editSelectedWorkflowTemplateVersion() {
        this.appRouter.navigateToWorkflowTemplateEdit(this.namespace, this.workflowTemplateDetail.uid);
    }

    cloneSelectedWorkflowTemplateVersion() {
        this.appRouter.navigateToWorkflowTemplateClone(this.namespace, this.workflowTemplate.uid);
    }

    onCronWorkflowPageChange(event: PageEvent) {
        this.cronWorkflowPagination.page = event.pageIndex;
        this.cronWorkflowPagination.pageSize = event.pageSize;

        this.getCronWorkflows();
    }

    deleteWorkflowTemplate() {
        const dialog = this.dialog.open(ConfirmationDialogComponent, {
            width: '500px',
            data: {
                title: 'Are you sure you want to delete this template?',
                message: 'All related Workflow Executions and Scheduled Workflows will also be deleted.',
                confirmText: 'YES, DELETE TEMPLATE',
                type: 'delete'
            }
        });

        dialog.afterClosed().subscribe(res => {
            if (!res) {
                return;
            }

            this.workflowTemplateService.archiveWorkflowTemplate(this.namespace, this.uid)
                .subscribe(() => {
                    this.router.navigate(['/', this.namespace, 'workflow-templates']);

                    this.alertService.storeAlert(new Alert({
                        message: `Workflow template '${this.workflowTemplate.name}' has been deleted`,
                        type: 'success'
                    }));
                });
        });
    }

    getCronWorkflows() {
        // Tab is 0 based, so we add 1, since API is 1 based.
        const page = this.cronWorkflowPagination.page + 1;
        const pageSize = this.cronWorkflowPagination.pageSize;

        this.cronWorkflowService.listCronWorkflows(this.namespace, this.uid, pageSize, page)
            .subscribe(res => {
                this.cronWorkflowResponse = res;
                this.cronWorkflows = res.cronWorkflows;

                this.hasCronWorkflows = !(page === 1 && !res.cronWorkflows);
            });
    }

    updateShowWorkflowExecutionCallToAction() {
        if (!this.matTabGroup) {
            return;
        }

        this.showWorkflowExecutionsCallToAction = !this.hasWorkflowExecutions && this.matTabGroup.selectedIndex === 0;
    }

    updateShowCronWorkflowsCallToAction() {
        if (!this.matTabGroup) {
            return;
        }

        this.showCronWorkflowsCallToAction = !this.hasCronWorkflows && this.matTabGroup.selectedIndex === 1;
    }

    updateBackLink(namespace: string) {
        const backLink = this.appRouter.getBackLink(namespace, {
            name: 'Back to workflow templates',
            route: `/${namespace}/workflow-templates`,
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
            this.appRouter.navigateToWorkflowTemplates(this.namespace);
        }
    }
}
