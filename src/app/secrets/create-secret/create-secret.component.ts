import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AlertService } from '../../alert/alert.service';
import { Alert } from '../../alert/alert';
import { SecretServiceService } from '../../../api';
import { Secret as ApiSecret } from '../../../api/model/secret';
import { AppRouter } from '../../router/app-router.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
    selector: 'app-create-secret',
    templateUrl: './create-secret.component.html',
    styleUrls: ['./create-secret.component.scss']
})
export class CreateSecretComponent implements OnInit {
    namespace = '';
    secretName = '';

    form: FormGroup;
    keyName: AbstractControl;
    value: AbstractControl;

    constructor(
        private activatedRoute: ActivatedRoute,
        private formBuilder: FormBuilder,
        private appRouter: AppRouter,
        private secretService: SecretServiceService,
        private alertService: AlertService
    ) {
    }

    ngOnInit() {
        this.activatedRoute.paramMap.subscribe(next => {
            this.namespace = next.get('namespace');
            this.secretName = next.get('secret-name');
        });

        this.form = this.formBuilder.group({
            keyName: ['', Validators.compose([
                Validators.required,
                Validators.pattern(/^[A-Za-z_-][A-Za-z0-9_-]*$/),
            ])],
            value: ['', Validators.required],
        });

        this.keyName = this.form.get('keyName');
        this.value = this.form.get('value');
    }

    cancel() {
        this.appRouter.navigateToEnvironmentVariables(this.namespace);
    }

    create() {
        const key = this.keyName.value;
        const data: ApiSecret = {
            name: this.secretName,
            data: {}
        };

        data.data[key] = this.value.value;

        this.secretService.addSecretKeyValue(this.namespace, this.secretName, data)
            .subscribe(res => {
                this.appRouter.navigateToEnvironmentVariables(this.namespace);
                this.alertService.storeAlert(new Alert({
                    message: `Environment variable '${key}' created`,
                    type: 'success',
                }));
            }, (err: HttpErrorResponse) => {
                const alert = new Alert({
                    type: 'danger',
                    message: 'Unable to create secret'
                });

                if (err.status === 403) {
                    alert.message = 'Unauthorized to create secret';
                }

                this.alertService.storeAlert(alert);
            });
    }
}
