using Domain.ActionModels;
using Domain.DbModels;
using Domain.Dtos;
using Domain.Models;
using Domain.Services;
using Microsoft.Extensions.Logging;
using System.Linq;

namespace Application.Services;

public class SegmentService
{
    private readonly SegmentRepository _segmentRepository_;
    private readonly OptionRepository _optionRepository_;
    private readonly LocationRepository _locationRepository;
    private readonly OptionService _optionService_;
    private readonly IBookingLinkParser _bookingLinkParser;
    private readonly IGoogleFlightsLinkParser _googleFlightsLinkParser;
    private readonly ILogger<SegmentService> _logger;

    public SegmentService(
        SegmentRepository segmentRepository,
        OptionRepository optionRepository,
        LocationRepository locationRepository,
        OptionService optionService,
        IBookingLinkParser bookingLinkParser,
        IGoogleFlightsLinkParser googleFlightsLinkParser,
        ILogger<SegmentService> logger)
    {
        _segmentRepository_ = segmentRepository;
        _optionRepository_ = optionRepository;
        _locationRepository = locationRepository;
        _optionService_ = optionService;
        _bookingLinkParser = bookingLinkParser;
        _googleFlightsLinkParser = googleFlightsLinkParser;
        _logger = logger;
    }

    public async Task<List<SegmentDto>> GetAllByOptionIdAsync(int optionId, CancellationToken cancellationToken)
    {
        var segments = await _segmentRepository_.GetAllByOptionIdAsync(optionId, cancellationToken);
        var result = segments.Select(s => new SegmentDto
        {
            Id = s.id,
            Cost = s.cost,
            EndDateTimeUtc = s.end_datetime_utc,
            EndDateTimeUtcOffset = s.end_datetime_utc_offset,
            Name = s.name,
            StartDateTimeUtc = s.start_datetime_utc,
            StartDateTimeUtcOffset = s.start_datetime_utc_offset,
            TripId = s.trip_id,
            SegmentTypeId = s.segment_type_id,
            Comment = s.comment,
            StartLocationId = s.start_location_id,
            EndLocationId = s.end_location_id,
            IsUiVisible = s.is_ui_visible,
            CurrencyId = s.currency_id,
        }).ToList();
        await RetrieveLocationsForSegmentsAsync(result, cancellationToken);
        return result;
    }

    public async Task<List<SegmentDto>> GetAllByTripIdAsync(int tripId, CancellationToken cancellationToken)
    {
        var segments = await _segmentRepository_.GetAllByTripIdAsync(tripId, cancellationToken);
        var result = segments.Select(s => new SegmentDto
            {
                Id = s.id,
                Cost = s.cost,
                EndDateTimeUtc = s.end_datetime_utc,
                EndDateTimeUtcOffset = s.end_datetime_utc_offset,
                Name = s.name,
                StartDateTimeUtc = s.start_datetime_utc,
                StartDateTimeUtcOffset = s.start_datetime_utc_offset,
                TripId = s.trip_id,
                SegmentTypeId = s.segment_type_id,
                Comment = s.comment,
                StartLocationId = s.start_location_id,
                EndLocationId = s.end_location_id,
                IsUiVisible = s.is_ui_visible,
                CurrencyId = s.currency_id,
            })
            .OrderBy(s => s.StartDateTimeUtc)
            .ToList();

        await RetrieveLocationsForSegmentsAsync(result, cancellationToken);

        return result;
    }


    public async Task<SegmentDto?> GetAsync(int segmentId, CancellationToken cancellationToken)
    {
        var segment = await _segmentRepository_.GetAsync(segmentId, cancellationToken);
        var result = segment == null
            ? null
            : new SegmentDto
            {
                Id = segment.id,
                Cost = segment.cost,
                EndDateTimeUtc = segment.end_datetime_utc,
                EndDateTimeUtcOffset = segment.end_datetime_utc_offset,
                Name = segment.name,
                StartDateTimeUtc = segment.start_datetime_utc,
                StartDateTimeUtcOffset = segment.start_datetime_utc_offset,
                TripId = segment.trip_id,
                SegmentTypeId = segment.segment_type_id,
                Comment = segment.comment,
                IsUiVisible = segment.is_ui_visible,
                CurrencyId = segment.currency_id,
            };
        if (result != null)
            await RetrieveLocationsForSegmentAsync(result, cancellationToken);
        return result;
    }

    public async Task CreateAsync(SegmentDto segment, CancellationToken cancellationToken)
    {
        var utcStart = ConvertWithOffset(segment.StartDateTimeUtc, segment.StartDateTimeUtcOffset);
        var utcEnd = ConvertWithOffset(segment.EndDateTimeUtc, segment.EndDateTimeUtcOffset);
        LocationDbm startLocation = null;
        LocationDbm endLocation = null;
        if (segment.StartLocation != null)
        {
            startLocation = await _locationRepository.CreateAsync(new LocationDbm
            {
                name = segment.StartLocation.Name,
                provider = segment.StartLocation.Provider,
                provider_place_id = segment.StartLocation.ProviderPlaceId,
                country_code = segment.StartLocation.CountryCode,
                country = segment.StartLocation.Country,
                lat = segment.StartLocation.Latitude,
                lng = segment.StartLocation.Longitude,
            }, cancellationToken);
        }

        if (segment.EndLocation != null)
        {
            endLocation = await _locationRepository.CreateAsync(new LocationDbm
            {
                name = segment.EndLocation.Name,
                provider = segment.EndLocation.Provider,
                provider_place_id = segment.EndLocation.ProviderPlaceId,
                country_code = segment.EndLocation.CountryCode,
                country = segment.EndLocation.Country,
                lat = segment.EndLocation.Latitude,
                lng = segment.EndLocation.Longitude,
            }, cancellationToken);
        }

        await _segmentRepository_.CreateAsync(new SegmentDbm
        {
            trip_id = segment.TripId,
            start_datetime_utc = utcStart,
            start_datetime_utc_offset = segment.StartDateTimeUtcOffset,
            end_datetime_utc = utcEnd,
            end_datetime_utc_offset = segment.EndDateTimeUtcOffset,
            name = segment.Name,
            cost = segment.Cost,
            segment_type_id = segment.SegmentTypeId,
            comment = segment.Comment,
            start_location_id = startLocation?.id,
            end_location_id = endLocation?.id,
            is_ui_visible = segment.IsUiVisible,
            currency_id = segment.CurrencyId == 0 ? 1 : segment.CurrencyId,
        }, cancellationToken);
    }

    public async Task UpdateAsync(SegmentDto segment, CancellationToken cancellationToken)
    {
        try
        {
            var persistedSegment = await _segmentRepository_.GetAsync(segment.Id, cancellationToken);
            var utcStart = ConvertWithOffset(segment.StartDateTimeUtc, segment.StartDateTimeUtcOffset);
            var utcEnd = ConvertWithOffset(segment.EndDateTimeUtc, segment.EndDateTimeUtcOffset);
            if (segment.StartLocation != null)
            {
                if (segment.StartLocation.Id == 0)
                {
                    var startLocation = await _locationRepository.CreateAsync(new LocationDbm
                    {
                        name = segment.StartLocation.Name,
                        provider = segment.StartLocation.Provider,
                        provider_place_id = segment.StartLocation.ProviderPlaceId,
                        country_code = segment.StartLocation.CountryCode,
                        country = segment.StartLocation.Country,
                        lat = segment.StartLocation.Latitude,
                        lng = segment.StartLocation.Longitude,
                    }, cancellationToken);
                    segment.StartLocation.Id = startLocation.id;
                }
                else
                {
                    await _locationRepository.UpdateAsync(new LocationDbm
                    {
                        id = segment.StartLocation.Id,
                        name = segment.StartLocation.Name,
                        provider = segment.StartLocation.Provider,
                        provider_place_id = segment.StartLocation.ProviderPlaceId,
                        country_code = segment.StartLocation.CountryCode,
                        country = segment.StartLocation.Country,
                        lat = segment.StartLocation.Latitude,
                        lng = segment.StartLocation.Longitude,
                    }, cancellationToken);
                }
            }

            if (segment.EndLocation != null)
            {
                if (segment.EndLocation.Id == 0)
                {
                    var endLocation = await _locationRepository.CreateAsync(new LocationDbm
                    {
                        name = segment.EndLocation.Name,
                        provider = segment.EndLocation.Provider,
                        provider_place_id = segment.EndLocation.ProviderPlaceId,
                        country_code = segment.EndLocation.CountryCode,
                        country = segment.EndLocation.Country,
                        lat = segment.EndLocation.Latitude,
                        lng = segment.EndLocation.Longitude,
                    }, cancellationToken);
                    segment.EndLocation.Id = endLocation.id;
                }
                else
                {
                    await _locationRepository.UpdateAsync(new LocationDbm
                    {
                        id = segment.EndLocation.Id,
                        name = segment.EndLocation.Name,
                        provider = segment.EndLocation.Provider,
                        provider_place_id = segment.EndLocation.ProviderPlaceId,
                        country_code = segment.EndLocation.CountryCode,
                        country = segment.EndLocation.Country,
                        lat = segment.EndLocation.Latitude,
                        lng = segment.EndLocation.Longitude,
                    }, cancellationToken);
                }
            }

            var currencyId = segment.CurrencyId == 0
                ? persistedSegment?.currency_id ?? 1
                : segment.CurrencyId;

            await _segmentRepository_.UpdateAsync(new SegmentDbm
            {
                id = segment.Id,
                trip_id = segment.TripId,
                start_datetime_utc = utcStart,
                start_datetime_utc_offset = segment.StartDateTimeUtcOffset,
                end_datetime_utc = utcEnd,
                end_datetime_utc_offset = segment.EndDateTimeUtcOffset,
                name = segment.Name,
                cost = segment.Cost,
                segment_type_id = segment.SegmentTypeId,
                comment = segment.Comment,
                start_location_id = segment.StartLocation?.Id,
                end_location_id = segment.EndLocation?.Id,
                is_ui_visible = segment.IsUiVisible,
                currency_id = currencyId,
            }, cancellationToken);

            await UpdateOptionsRelatedBySegmentIdAsync(segment.Id, cancellationToken);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Error updating segment");
            throw;
        }
    }

    public async Task DeleteAsync(int segmentId, CancellationToken cancellationToken)
    {
        await _segmentRepository_.DeleteAsync(segmentId, cancellationToken);
        await UpdateOptionsRelatedBySegmentIdAsync(segmentId, cancellationToken);
    }

    public async Task ConnectSegmentWithOptionsAsync(UpdateConnectedOptionsAm am, CancellationToken cancellationToken)
    {
        await _segmentRepository_.ConnectSegmentsWithOptionAsync(am.SegmentId, am.OptionIds, cancellationToken);
        await UpdateOptionsRelatedBySegmentIdAsync(am.SegmentId, cancellationToken);
    }

    private async Task UpdateOptionsRelatedBySegmentIdAsync(int segmentId, CancellationToken cancellationToken)
    {
        var segmentOptions = await _optionService_.GetAllBySegmentIdAsync(segmentId, cancellationToken);
        if (segmentOptions.Count != 0)
        {
            foreach (var option in segmentOptions)
            {
                var optionFinal = await _optionService_.RecalculateOptionStateAsync(option.Id, cancellationToken);
                await _optionService_.UpdateAsync(optionFinal, cancellationToken);
            }
        }
    }

    public async Task<List<OptionDto>> GetConnectedOptionsAsync(int segmentId, CancellationToken cancellationToken)
    {
        var options = await _optionRepository_.GetAllConnectedToSegmentIdAsync(segmentId, cancellationToken);
        if (options.Count != 0)
        {
            var result = options.Select(o => new OptionDto
            {
                Id = o.id,
                Name = o.name,
                IsUiVisible = o.is_ui_visible,
                TripId = o.trip_id
            }).ToList();
            return result;
        }

        return new List<OptionDto>();
    }

    public async Task<List<SegmentTypeDto>> GetAllSegmentTypesAsync(CancellationToken cancellationToken)
    {
        var segmentTypes = await _segmentRepository_.GetAllSegmentTypesAsync(cancellationToken);
        var result = segmentTypes.Select(st => new SegmentTypeDto
        {
            Id = st.id,
            ShortName = st.short_name,
            Name = st.name,
            Description = st.description,
            Color = st.color,
            IconSvg = st.icon_svg
        }).ToList();
        return result;
    }

    private DateTime ConvertWithOffset(DateTime dateOriginal, int offset)
    {
        var converted = dateOriginal.AddHours(-1 * offset);
        // -1 because people set the time in selected timezone, 
        // but we need to convert it to utc
        var utc = new DateTime(converted.Ticks, DateTimeKind.Utc);
        return utc;
    }

    #region Location

    private async Task RetrieveLocationsForSegmentsAsync(List<SegmentDto> segments, CancellationToken cancellationToken)
    {
        foreach (var segment in segments.Where(s => s.StartLocationId != null || s.EndLocationId != null))
        {
            await RetrieveLocationsForSegmentAsync(segment, cancellationToken);
        }
    }

    private async Task RetrieveLocationsForSegmentAsync(SegmentDto segment, CancellationToken cancellationToken)
    {
        if (segment.StartLocationId != null)
        {
            var startLocation = await _locationRepository.GetAsync(segment.StartLocationId.Value, cancellationToken);
            segment.StartLocation = new LocationDto
            {
                Id = startLocation.id,
                Name = startLocation.name,
                Country = startLocation.country,
                CountryCode = startLocation.country_code,
                ProviderPlaceId = startLocation.provider_place_id,
                Provider = startLocation.provider,
                Latitude = startLocation.lat,
                Longitude = startLocation.lng,
            };
        }

        if (segment.EndLocationId != null)
        {
            var endLocation = await _locationRepository.GetAsync(segment.EndLocationId.Value, cancellationToken);
            segment.EndLocation = new LocationDto
            {
                Id = endLocation.id,
                Name = endLocation.name,
                Country = endLocation.country,
                CountryCode = endLocation.country_code,
                Latitude = endLocation.lat,
                Longitude = endLocation.lng,
            };
        }
    }

    public Task<SegmentSuggestionDto> ParseBookingLinkAsync(string url, CancellationToken cancellationToken)
    {
        return _bookingLinkParser.ParseBookingLinkAsync(url, cancellationToken);
    }

    public Task<SegmentSuggestionDto> ParseFlightsLinkAsync(string url, CancellationToken cancellationToken)
    {
        return _googleFlightsLinkParser.ParseFlightsLinkAsync(url, cancellationToken);
    }

#endregion
}
