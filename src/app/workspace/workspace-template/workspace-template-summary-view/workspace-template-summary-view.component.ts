import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { WorkspaceTemplate } from '../../../../api';
import { Permissions } from '../../../auth/models';

@Component({
  selector: 'app-workspace-template-summary-view',
  templateUrl: './workspace-template-summary-view.component.html',
  styleUrls: ['./workspace-template-summary-view.component.scss']
})
export class WorkspaceTemplateSummaryViewComponent implements OnInit {
  @Input() iconClass = 'fas fa-desktop';
  @Input() template: WorkspaceTemplate;
  @Input() showMenu = true;
  @Input() deleting = false;
  @Input() permissions = new Permissions();

  @Output() createWorkspaceClicked = new EventEmitter<WorkspaceTemplate>();
  @Output() cloneWorkspaceTemplateClicked = new EventEmitter<WorkspaceTemplate>();
  @Output() deleteWorkspaceTemplateClicked = new EventEmitter<WorkspaceTemplate>();
  @Output() shareWorkspaceTemplateClicked = new EventEmitter<WorkspaceTemplate>();

  constructor() { }

  ngOnInit() {
  }

  createWorkspace() {
    this.createWorkspaceClicked.emit(this.template);
  }

  cloneWorkspaceTemplate(template: WorkspaceTemplate) {
    this.cloneWorkspaceTemplateClicked.emit(template);
  }

  deleteWorkspaceTemplate(template: WorkspaceTemplate) {
    this.deleteWorkspaceTemplateClicked.emit(template);
  }

  shareWorkspaceTemplate(template: WorkspaceTemplate) {
    this.shareWorkspaceTemplateClicked.emit(template);
  }
}
