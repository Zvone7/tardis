using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class TripService
{
    private readonly TripRepository _tripRepository_;
    private readonly UserService _userService;

    public TripService(TripRepository tripRepository, UserService userService)
    {
        _tripRepository_ = tripRepository;
        _userService = userService;
    }

    public async Task<List<TripDto>> GetAllAsync(int userId, CancellationToken cancellationToken)
    {
        var trips = await _tripRepository_.GetAllActiveAsync(userId, cancellationToken);
        var result = trips.Select(t => new TripDto
        {
            Id = t.Id,
            Name = t.Name,
            Description = t.Description,
            IsActive = t.is_active,
            StartTime = t.StartTime,
            EndTime = t.EndTime,
            CurrencyId = t.currency_id
        }).ToList();
        return result;
    }

    public async Task<TripDto?> GetAsync(int tripId, CancellationToken cancellationToken)
    {
        var trip = await _tripRepository_.GetAsync(tripId, cancellationToken);
        var result = trip == null ? null : new TripDto
        {
            Id = trip.Id,
            Name = trip.Name,
            Description = trip.Description,
            IsActive = trip.is_active,
            CurrencyId = trip.currency_id
        };
        return result;
    }

    public async Task<TripDto> CreateAsync(int userId, TripDto trip, CancellationToken cancellationToken)
    {
        var currencyId = await ResolveCurrencyIdAsync(userId, trip.CurrencyId, cancellationToken);
        var created = await _tripRepository_.CreateAsync(userId,
            new TripDbm
            {
                Name = trip.Name,
                Description = trip.Description,
                is_active = trip.IsActive,
                currency_id = currencyId
            }, cancellationToken);

        var result = new TripDto
        {
            Id = created.Id,
            Name = created.Name,
            Description = created.Description,
            IsActive = created.is_active,
            CurrencyId = created.currency_id
        };

        return result;
    }

    public async Task<TripDto> UpdateAsync(TripDto trip, CancellationToken cancellationToken)
    {
        var persisted = await _tripRepository_.GetAsync(trip.Id, cancellationToken);
        if (persisted == null)
        {
            throw new InvalidOperationException($"Trip with id {trip.Id} was not found.");
        }
        var currencyId = trip.CurrencyId == 0 ? persisted?.currency_id ?? 1 : trip.CurrencyId;
        var updated = await _tripRepository_.UpdateAsync(new TripDbm
        {
            Id = trip.Id,
            Name = trip.Name,
            Description = trip.Description,
            is_active = trip.IsActive,
            currency_id = currencyId
        }, cancellationToken);

        var result = new TripDto
        {
            Id = updated.Id,
            Name = updated.Name,
            Description = updated.Description,
            IsActive = updated.is_active,
            CurrencyId = updated.currency_id
        };

        return result;
    }

    public async Task DeleteTripAsync(int tripId, CancellationToken cancellationToken)
    {
        await _tripRepository_.DeleteAsync(tripId, cancellationToken);
    }

    public async Task<bool> CheckUserHasAccessToTripAsync(int userId, int tripId, CancellationToken cancellationToken)
    {
       var res = await _tripRepository_.CheckUserHasAccessToTripAsync(userId, tripId, cancellationToken);
       return res;
    }

    private async Task<int> ResolveCurrencyIdAsync(int userId, int requestedCurrencyId, CancellationToken cancellationToken)
    {
        if (requestedCurrencyId > 0) return requestedCurrencyId;

        var user = await _userService.GetAsync(userId, cancellationToken);
        var preferredCurrency = user?.UserPreference?.PreferredCurrencyId ?? 0;
        if (preferredCurrency > 0) return preferredCurrency;

        return 1;
    }

}
