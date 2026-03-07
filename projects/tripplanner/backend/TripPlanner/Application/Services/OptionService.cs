using Db.Repositories;
using Domain.ActionModels;
using Domain.DbModels;
using Domain.Dtos;

namespace Application.Services;

public class OptionService
{
    private readonly OptionRepository _optionRepository_;
    private readonly SegmentRepository _segmentRepository_;
    private readonly TripRepository _tripRepository_;
    private readonly CurrencyRepository _currencyRepository_;

    public OptionService(
        OptionRepository optionRepository,
        SegmentRepository segmentRepository,
        TripRepository tripRepository,
        CurrencyRepository currencyRepository)
    {
        _optionRepository_ = optionRepository;
        _segmentRepository_ = segmentRepository;
        _tripRepository_ = tripRepository;
        _currencyRepository_ = currencyRepository;
    }

    public async Task<List<OptionDto>> GetAllByTripIdAsync(int tripId, CancellationToken ct)
    {
        var options = await _optionRepository_.GetOptionsByTripIdAsync(tripId, ct);
        var list = new List<OptionDto>(options.Count);
        var trip = await _tripRepository_.GetAsync(tripId, ct);
        var tripCurrencyId = trip?.currency_id;
        var conversions = await _currencyRepository_.GetConversionsAsync(ct);
        var conversionGraph = BuildConversionGraph(conversions);

        foreach (var o in options)
        {
            var dto = new OptionDto
            {
                Id = o.id,
                Name = o.name,
                StartDateTimeUtc = o.start_datetime_utc,
                EndDateTimeUtc = o.end_datetime_utc,
                TripId = o.trip_id,
                TotalCost = o.total_cost,
                IsUiVisible = o.is_ui_visible
            };

            var segments = await _segmentRepository_.GetAllByOptionIdAsync(o.id, ct);

            var final = await RecalculateFeDisplayDataAsync(dto, segments, tripCurrencyId, conversionGraph, ct);
            list.Add(final);
        }

        return list
            .OrderBy(x => x.StartDateTimeUtc)
            .ToList();
    }


    public async Task<OptionDto?> GetAsync(int optionId, CancellationToken cancellationToken)
    {
        var option = await _optionRepository_.GetAsync(optionId, cancellationToken);
        var result = option == null
            ? null
            : new OptionDto
            {
                Id = option.id,
                Name = option.name,
                StartDateTimeUtc = option.start_datetime_utc,
                EndDateTimeUtc = option.end_datetime_utc,
                TripId = option.trip_id,
                TotalCost = option.total_cost,
                IsUiVisible = option.is_ui_visible
            };
        return result;
    }

    public async Task CreateAsync(OptionDto option, CancellationToken cancellationToken)
    {
        await _optionRepository_.CreateAsync(new TripOptionDbm
        {
            name = option.Name,
            start_datetime_utc = null,
            end_datetime_utc = null,
            trip_id = option.TripId,
            total_cost = 0
        }, cancellationToken);
    }

    public async Task UpdateAsync(OptionDto option, CancellationToken cancellationToken)
    {
        await _optionRepository_.UpdateAsync(new TripOptionDbm
        {
            id = option.Id,
            name = option.Name,
            start_datetime_utc = option.StartDateTimeUtc,
            end_datetime_utc = option.EndDateTimeUtc,
            trip_id = option.TripId,
            total_cost = option.TotalCost,
            is_ui_visible = option.IsUiVisible
        }, cancellationToken);
    }

    public async Task UpdateAsync(UpdateOptionAm option, CancellationToken cancellationToken)
    {
        await _optionRepository_.UpdateLightAsync(new TripOptionDbm
        {
            id = option.Id,
            name = option.Name,
            is_ui_visible = option.IsUiVisible,
        }, cancellationToken);
    }

    public async Task DeleteAsync(int optionId, CancellationToken cancellationToken)
    {
        var option = await _optionRepository_.GetAsync(optionId, cancellationToken);
        if (option == null)
            throw new InvalidDataException($"Option with id {optionId} not found.");
        await _optionRepository_.DeleteAsync(optionId, cancellationToken);
    }

    public async Task<OptionDto> RecalculateOptionStateAsync(int optionId, CancellationToken cancellationToken)
    {
        var segmentsForOption = await _segmentRepository_.GetAllByOptionIdAsync(optionId, cancellationToken);
        var option = await GetAsync(optionId, cancellationToken);
        if (option == null)
            throw new InvalidDataException($"Option with id {optionId} not found.");

        var trip = await _tripRepository_.GetAsync(option.TripId, cancellationToken);
        var tripCurrencyId = trip?.currency_id;
        var conversions = await _currencyRepository_.GetConversionsAsync(cancellationToken);
        var conversionGraph = BuildConversionGraph(conversions);

        if (segmentsForOption.Count == 0)
        {
            option.TotalCost = 0;
            option.StartDateTimeUtc = null;
            option.EndDateTimeUtc = null;
            return await RecalculateFeDisplayDataAsync(option, segmentsForOption, tripCurrencyId, conversionGraph, cancellationToken);
        }

        option.TotalCost = segmentsForOption.Sum(s => ConvertCostToCurrency(s.cost, s.currency_id, tripCurrencyId, conversionGraph));
        option.StartDateTimeUtc = segmentsForOption.Min(s => s.start_datetime_utc);
        option.EndDateTimeUtc = segmentsForOption.Max(s => s.start_datetime_utc);
        var updated = await RecalculateFeDisplayDataAsync(option, segmentsForOption, tripCurrencyId, conversionGraph, cancellationToken);

        return updated;
    }

    private async Task<OptionDto> RecalculateFeDisplayDataAsync(
        OptionDto option,
        List<SegmentDbm> segmentsForOption,
        int? tripCurrencyId,
        Dictionary<int, List<(int to, decimal rate)>>? conversionGraph,
        CancellationToken cancellationToken)
    {
        var segmentTypes = await _segmentRepository_.GetAllSegmentTypesAsync(cancellationToken);
        var totalDays = (option.EndDateTimeUtc - option.StartDateTimeUtc)?.TotalDays;
        option.TotalDays = totalDays.HasValue && totalDays > 0 ? (int)Math.Ceiling(totalDays.Value) : 1;
        var transportSegmentTypes = segmentTypes.Where(st => st.short_name.ToLower().Contains("transport")).Select(st => st.id).ToHashSet();
        var accomodationSegmentTypes = segmentTypes.Where(st => st.short_name.ToLower().Contains("accomodation")).Select(st => st.id).ToHashSet();
        if (tripCurrencyId.HasValue && conversionGraph != null)
        {
            option.TotalCost = segmentsForOption.Sum(s => ConvertCostToCurrency(s.cost, s.currency_id, tripCurrencyId, conversionGraph));
        }
        decimal SumConverted(Func<SegmentDbm, bool> predicate) =>
            segmentsForOption.Where(predicate).Sum(s => ConvertCostToCurrency(s.cost, s.currency_id, tripCurrencyId, conversionGraph));
        var dictionaryOfCosts = new Dictionary<CostType, decimal>
        {
            { CostType.Transport, SumConverted(s => transportSegmentTypes.Contains(s.segment_type_id)) },
            { CostType.Accommodation, SumConverted(s => accomodationSegmentTypes.Contains(s.segment_type_id)) },
            { CostType.Other, SumConverted(s => !transportSegmentTypes.Contains(s.segment_type_id) && !accomodationSegmentTypes.Contains(s.segment_type_id)) }
        };
        option.CostPerType = dictionaryOfCosts;
        option.CostPerDay = option.TotalDays > 0 ? option.TotalCost / option.TotalDays : option.TotalCost;

        return option;
    }

    public async Task<List<OptionDto>> GetAllBySegmentIdAsync(int segmentId, CancellationToken cancellationToken)
    {
        var options = await _optionRepository_.GetOptionsBySegmentIdAsync(segmentId, cancellationToken);
        var result = options.Select(o => new OptionDto
        {
            Id = o.id,
            Name = o.name,
            StartDateTimeUtc = o.start_datetime_utc,
            EndDateTimeUtc = o.end_datetime_utc,
            TripId = o.trip_id,
            TotalCost = o.total_cost,
            IsUiVisible = o.is_ui_visible
        }).ToList();
        return result;
    }

    public async Task ConnectOptionWithSegmentsAsync(UpdateConnectedSegmentsAm am, CancellationToken cancellationToken)
    {
        var option = await _optionRepository_.GetAsync(am.OptionId, cancellationToken);
        if (option == null)
            throw new InvalidDataException($"Option with id {am.OptionId} not found.");
        await _optionRepository_.ConnectOptionWithSegmentsAsync(am.OptionId, am.SegmentIds, cancellationToken);
        var optionFinal = await RecalculateOptionStateAsync(am.OptionId, cancellationToken);
        await UpdateAsync(optionFinal, cancellationToken);
    }

    public async Task<List<SegmentDto>> GetConnectedSegmentsAsync(int optionId, CancellationToken cancellationToken)
    {
        var segments = await _segmentRepository_.GetAllByOptionIdAsync(optionId, cancellationToken);
        var result = segments.Select(s => new SegmentDto
        {
            Id = s.id,
            TripId = s.trip_id,
            StartDateTimeUtc = s.start_datetime_utc,
            EndDateTimeUtc = s.end_datetime_utc,
            Name = s.name,
            Cost = s.cost,
            SegmentTypeId = s.segment_type_id,
            IsUiVisible = s.is_ui_visible,
            CurrencyId = s.currency_id,
        }).ToList();
        return result;
    }

    private static Dictionary<int, List<(int toCurrencyId, decimal rate)>> BuildConversionGraph(IEnumerable<CurrencyConversionDbm> conversions)
    {
        var graph = new Dictionary<int, List<(int toCurrencyId, decimal rate)>>();
        foreach (var conversion in conversions)
        {
            if (!graph.TryGetValue(conversion.from_currency_id, out var list))
            {
                list = new List<(int, decimal)>();
                graph[conversion.from_currency_id] = list;
            }
            list.Add((conversion.to_currency_id, conversion.rate));

            if (conversion.rate != 0)
            {
                if (!graph.TryGetValue(conversion.to_currency_id, out var reverse))
                {
                    reverse = new List<(int, decimal)>();
                    graph[conversion.to_currency_id] = reverse;
                }
                reverse.Add((conversion.from_currency_id, 1 / conversion.rate));
            }
        }
        return graph;
    }

    private static decimal ConvertCostToCurrency(decimal amount, int? fromCurrencyId, int? targetCurrencyId, Dictionary<int, List<(int toCurrencyId, decimal rate)>>? graph)
    {
        if (amount == 0) return 0;
        if (!targetCurrencyId.HasValue) return amount;
        if (!fromCurrencyId.HasValue || fromCurrencyId.Value == targetCurrencyId.Value) return amount;
        if (graph == null || graph.Count == 0) return amount;

        var rate = FindConversionRate(fromCurrencyId.Value, targetCurrencyId.Value, graph);
        if (!rate.HasValue) return amount;
        return amount * rate.Value;
    }

    private static decimal? FindConversionRate(int fromCurrencyId, int toCurrencyId, Dictionary<int, List<(int toCurrencyId, decimal rate)>> graph)
    {
        if (fromCurrencyId == toCurrencyId) return 1m;
        var visited = new HashSet<int> { fromCurrencyId };
        var queue = new Queue<(int currencyId, decimal rate)>();
        queue.Enqueue((fromCurrencyId, 1m));

        while (queue.Count > 0)
        {
            var (current, rateSoFar) = queue.Dequeue();
            if (!graph.TryGetValue(current, out var neighbors)) continue;
            foreach (var (next, rate) in neighbors)
            {
                if (!visited.Add(next)) continue;
                var nextRate = rateSoFar * rate;
                if (next == toCurrencyId) return nextRate;
                queue.Enqueue((next, nextRate));
            }
        }

        return null;
    }
}
