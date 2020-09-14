import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NamespaceTracker } from '../namespace/namespace-tracker.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss']
})
export class NavbarComponent implements OnInit {
  activeRoute = 'templates';

  @Input() version: string;

  @Input() set activeUrl(value: string) {
    if (value === '') {
      this.activeRoute = 'templates';
      return;
    }

    const urlParts = value.split('/');

    for (const urlPart of urlParts) {
      if (urlPart === 'workspace-templates') {
        this.activeRoute = 'workspaces';
        return;
      }
      if (urlPart.indexOf('templates') >= 0 || urlPart.indexOf('workflows') >= 0) {
        this.activeRoute = 'templates';
        return;
      }
      if (urlPart.indexOf('secrets') >= 0) {
        this.activeRoute = 'secrets';
        return;
      }
      if (urlPart.indexOf('workspace') >= 0) {
        this.activeRoute = 'workspaces';
        return;
      }

      if (urlPart.indexOf('services') >= 0) {
        this.activeRoute = 'services';
        return;
      }
    }
  }

  @Input() servicesVisible?: boolean = undefined;

  @Output() logout = new EventEmitter();
  @Output() namespaceClick = new EventEmitter();

  constructor(public namespaceTracker: NamespaceTracker) {
  }

  ngOnInit() {

  }

  handleLogOut() {
    this.logout.emit();
  }

  handleNamespaceClick() {
    this.namespaceClick.emit();
  }
}