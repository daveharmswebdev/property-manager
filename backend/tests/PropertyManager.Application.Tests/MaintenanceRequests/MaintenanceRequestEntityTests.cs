using FluentAssertions;
using PropertyManager.Domain.Entities;
using PropertyManager.Domain.Enums;
using PropertyManager.Domain.Exceptions;

namespace PropertyManager.Application.Tests.MaintenanceRequests;

/// <summary>
/// Unit tests for MaintenanceRequest entity and MaintenanceRequestStatus enum (AC: #1, #2, #3).
/// </summary>
public class MaintenanceRequestEntityTests
{
    // AC #1: Entity has all required properties
    [Fact]
    public void MaintenanceRequest_HasAllRequiredProperties()
    {
        // Arrange & Act
        var request = new MaintenanceRequest();

        // Assert - verify all properties exist and have defaults
        request.Id.Should().Be(Guid.Empty);
        request.Description.Should().BeEmpty();
        request.Status.Should().Be(MaintenanceRequestStatus.Submitted);
        request.DismissalReason.Should().BeNull();
        request.PropertyId.Should().Be(Guid.Empty);
        request.SubmittedByUserId.Should().Be(Guid.Empty);
        request.WorkOrderId.Should().BeNull();
        request.AccountId.Should().Be(Guid.Empty);
        request.CreatedAt.Should().Be(default);
        request.UpdatedAt.Should().Be(default);
        request.DeletedAt.Should().BeNull();
    }

    // AC #2: MaintenanceRequestStatus enum has exactly 4 values
    [Fact]
    public void MaintenanceRequestStatus_HasExactlyFourValues()
    {
        var values = Enum.GetValues<MaintenanceRequestStatus>();
        values.Should().HaveCount(4);
        values.Should().Contain(MaintenanceRequestStatus.Submitted);
        values.Should().Contain(MaintenanceRequestStatus.InProgress);
        values.Should().Contain(MaintenanceRequestStatus.Resolved);
        values.Should().Contain(MaintenanceRequestStatus.Dismissed);
    }

    // AC #3: Valid transitions
    [Fact]
    public void TransitionTo_InProgress_FromSubmitted_Succeeds()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.Submitted };

        request.TransitionTo(MaintenanceRequestStatus.InProgress);

        request.Status.Should().Be(MaintenanceRequestStatus.InProgress);
    }

    [Fact]
    public void TransitionTo_Dismissed_FromSubmitted_Succeeds()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.Submitted };

        request.TransitionTo(MaintenanceRequestStatus.Dismissed);

        request.Status.Should().Be(MaintenanceRequestStatus.Dismissed);
    }

    [Fact]
    public void TransitionTo_Resolved_FromInProgress_Succeeds()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.InProgress };

        request.TransitionTo(MaintenanceRequestStatus.Resolved);

        request.Status.Should().Be(MaintenanceRequestStatus.Resolved);
    }

    // AC #3: Invalid transitions
    [Fact]
    public void TransitionTo_Resolved_FromSubmitted_ThrowsBusinessRuleException()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.Submitted };

        var act = () => request.TransitionTo(MaintenanceRequestStatus.Resolved);

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void TransitionTo_Dismissed_FromInProgress_ThrowsBusinessRuleException()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.InProgress };

        var act = () => request.TransitionTo(MaintenanceRequestStatus.Dismissed);

        act.Should().Throw<BusinessRuleException>();
    }

    [Fact]
    public void TransitionTo_Submitted_FromAnyStatus_ThrowsBusinessRuleException()
    {
        var statuses = new[]
        {
            MaintenanceRequestStatus.Submitted,
            MaintenanceRequestStatus.InProgress,
            MaintenanceRequestStatus.Resolved,
            MaintenanceRequestStatus.Dismissed
        };

        foreach (var status in statuses)
        {
            var request = new MaintenanceRequest { Status = status };
            var act = () => request.TransitionTo(MaintenanceRequestStatus.Submitted);
            act.Should().Throw<BusinessRuleException>($"because transitioning from {status} to Submitted should not be allowed");
        }
    }

    [Fact]
    public void TransitionTo_InProgress_FromResolved_ThrowsBusinessRuleException()
    {
        var request = new MaintenanceRequest { Status = MaintenanceRequestStatus.Resolved };

        var act = () => request.TransitionTo(MaintenanceRequestStatus.InProgress);

        act.Should().Throw<BusinessRuleException>();
    }
}
