import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { WorkOrderFormComponent } from '../../components/work-order-form/work-order-form.component';

/**
 * WorkOrderCreateComponent (AC #6)
 *
 * Page for creating a new work order.
 * Supports pre-selecting property from query parameter.
 */
@Component({
  selector: 'app-work-order-create',
  standalone: true,
  imports: [CommonModule, WorkOrderFormComponent],
  template: `
    <div class="work-order-create-page">
      <h1>New Work Order</h1>
      <app-work-order-form [preSelectedPropertyId]="preSelectedPropertyId" />
    </div>
  `,
  styles: [
    `
      .work-order-create-page {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      h1 {
        margin-bottom: 24px;
      }
    `,
  ],
})
export class WorkOrderCreateComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  protected preSelectedPropertyId: string | null = null;

  ngOnInit(): void {
    // Check for propertyId query parameter (AC #6 - from property page)
    this.route.queryParams.subscribe((params) => {
      this.preSelectedPropertyId = params['propertyId'] || null;
    });
  }
}
