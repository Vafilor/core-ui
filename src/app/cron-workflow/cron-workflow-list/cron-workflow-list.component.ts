import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import {
    CreateWorkflowExecutionBody,
    CronWorkflow,
    CronWorkflowServiceService,
    WorkflowServiceService,
    WorkflowTemplate
} from '../../../api';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
    CronWorkflowEditData,
    CronWorkflowEditDialogComponent
} from '../cron-workflow-edit-dialog/cron-workflow-edit-dialog.component';
import { WorkflowExecuteDialogComponent } from '../../workflow/workflow-execute-dialog/workflow-execute-dialog.component';
import * as yaml from 'js-yaml';
import {
    ConfirmationDialogComponent,
    ConfirmationDialogData
} from '../../confirmation-dialog/confirmation-dialog.component';
import { AppRouter } from '../../router/app-router.service';

@Component({
    selector: 'app-cron-workflow-list',
    templateUrl: './cron-workflow-list.component.html',
    styleUrls: ['./cron-workflow-list.component.scss']
})
export class CronWorkflowListComponent implements OnInit, OnDestroy {
    private snackbarRef: MatSnackBarRef<SimpleSnackBar>;

    displayedColumns = ['name', 'schedule', 'spacer', 'actions'];

    // Maps a CronWorkflow by it's name to it's parsed manifest, providing access to scheduled, etc.
    parsedCronManifestsMap = new Map<string, object>();

    // tslint:disable-next-line:variable-name
    _cronWorkflows: CronWorkflow[] = [];

    @Input() namespace: string;

    @Input() set cronWorkflows(value: CronWorkflow[]) {
        this._cronWorkflows = value;

        this.parsedCronManifestsMap.clear();
        for (const workflow of value) {
            this.parsedCronManifestsMap[workflow.name] = yaml.safeLoad(workflow.manifest);
        }
    }
    get cronWorkflows(): CronWorkflow[] {
        return this._cronWorkflows;
    }

    @Input() template: WorkflowTemplate;

    // This is fired whenever we add or remove a row from the list.
    @Output() listRowsModified = new EventEmitter();

    dialogRef: MatDialogRef<CronWorkflowEditDialogComponent>;

    constructor(
        private activatedRoute: ActivatedRoute,
        private cronWorkflowServiceService: CronWorkflowServiceService,
        private workflowServiceService: WorkflowServiceService,
        private dialog: MatDialog,
        private snackbar: MatSnackBar,
        private appRouter: AppRouter) {
    }

    ngOnInit(): void {

    }

    ngOnDestroy(): void {
        if (this.snackbarRef) {
            this.snackbarRef.dismiss();
        }
    }

    onEdit(workflow: CronWorkflow) {
        const data: CronWorkflowEditData = {
            cronWorkflow: workflow,
            manifest: this.template.manifest
        };

        this.dialogRef = this.dialog.open(CronWorkflowEditDialogComponent, {
            width: '60vw',
            maxHeight: '100vh',
            data,
        });

        this.dialogRef.afterClosed().subscribe(res => {
            if (!res) {
                return;
            }

            const updatedData: CronWorkflow = {
                ...res.cron,
                workflowExecution: res.workflowExecution,
                labels: res.labels
            };
            updatedData.workflowExecution.workflowTemplate = this.template;

            // TODO update labels

            this.cronWorkflowServiceService.updateCronWorkflow(this.namespace, workflow.name, updatedData)
                .subscribe(res => {
                    for (const key in res) {
                        workflow[key] = res[key];
                    }

                    this.listRowsModified.emit();
                }, err => {
                    // Do nothing
                });
        });
    }

    onExecute(workflow: CronWorkflow) {
        const data: CreateWorkflowExecutionBody = {
            workflowTemplateUid: this.template.uid,
            workflowTemplateVersion: this.template.version,
        };

        if (workflow.workflowExecution) {
            data.parameters = workflow.workflowExecution.parameters;
        } else {
            data.parameters = WorkflowExecuteDialogComponent.pluckParameters(this.template.manifest);
        }

        if (!data.parameters) {
            data.parameters = [];
        }

        this.workflowServiceService.createWorkflowExecution(this.namespace, data)
            .subscribe(res => {
                this.appRouter.navigateToWorkflowExecution(this.namespace, res.name);
            });
    }


    onDelete(workflow: CronWorkflow) {
        const data: ConfirmationDialogData = {
            title: `Are you sure you want to delete "${workflow.name}"?`,
            confirmText: 'DELETE',
            type: 'delete',
        };
        const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
            data
        });

        dialogRef.afterClosed().subscribe(res => {
            if (!res) {
                return;
            }

            this.cronWorkflowServiceService.deleteCronWorkflow(this.namespace, workflow.uid)
                .subscribe(res => {
                    this.listRowsModified.emit();
                    this.snackbarRef = this.snackbar.open('Scheduled workflow deleted', 'OK');
                }, err => {
                    this.snackbarRef = this.snackbar.open('Unable to stop workflow', 'OK');
                })
            ;
        });
    }
}
