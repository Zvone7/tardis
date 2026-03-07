using Application.Services;
using Domain.Models;
using Domain.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;

namespace Application.Tests;

public class GoogleFlightsLinkParserTest
{
    [Test]
    public async Task ParseFlightsLink_ShouldExtractAirportsDatesAndGeocode()
    {
        var fakeClient = new FakeLocationIqClient(query =>
        {
            if (query.Contains("OSL"))
            {
                return new[]
                {
                    new LocationIqItem
                    {
                        DisplayName = "Oslo Airport, Norway",
                        Lat = "60.1939",
                        Lon = "11.1004",
                        Address = new LocationIqAddress
                        {
                            City = "Oslo",
                            Country = "Norway",
                            CountryCode = "no"
                        },
                        PlaceId = "osl-airport"
                    }
                };
            }

            if (query.Contains("PRG"))
            {
                return new[]
                {
                    new LocationIqItem
                    {
                        DisplayName = "Prague Airport, Czechia",
                        Lat = "50.1008",
                        Lon = "14.26",
                        Address = new LocationIqAddress
                        {
                            City = "Prague",
                            Country = "Czechia",
                            CountryCode = "cz"
                        },
                        PlaceId = "prg-airport"
                    }
                };
            }

            return Array.Empty<LocationIqItem>();
        });
        var parser = BuildParser(fakeClient);
        const string flightsUrl =
            "https://www.google.com/travel/flights/booking?tfs=CBwQAhpMEgoyMDI2LTAxLTE1IiAKA09TTBIKMjAyNi0wMS0xNRoDUFJHKgJEWTIEMTUwMigAagwIAhIIL20vMDVsNjRyDAgDEggvbS8wNXl3Z0ABSAFwAYIBCwj___________8BmAEC&tfu=CmxDalJJTkV3MmRrZ3hURkJHWlVGQlFsUnJZa0ZDUnkwdExTMHRMUzB0TFd4dGNXb3hNRUZCUVVGQlIydHRRWGMwVHpCb1kyTkJFZ1pFV1RFMU1ESWFDZ2pGQlJBQUdnTk9UMHM0SEhDWE5nPT0SAggAIgA";

        var suggestion = await parser.ParseFlightsLinkAsync(flightsUrl, CancellationToken.None);

        suggestion.Name.Should().Contain("OSL").And.Contain("PRG");
        suggestion.SegmentTypeId.Should().Be(1);
        suggestion.StartDateLocal.Should().Be("2026-01-15T09:00");
        suggestion.EndDateLocal.Should().Be("2026-01-15T11:50");
        suggestion.Cost.Should().BeNull(); // price not available in link payload
        suggestion.StartLocation.Should().NotBeNull();
        suggestion.EndLocation.Should().NotBeNull();
        suggestion.StartLocationName.Should().Be("OSL");
        suggestion.EndLocationName.Should().Be("PRG");
        fakeClient.LastQuery.Should().Contain("PRG");
    }

    private static GoogleFlightsLinkParser BuildParser(ILocationIqClient? client = null)
    {
        var locationClient = client ?? new FakeLocationIqClient();
        return new GoogleFlightsLinkParser(locationClient, NullLogger<GoogleFlightsLinkParser>.Instance);
    }

    private sealed class FakeLocationIqClient : ILocationIqClient
    {
        private readonly Func<string, IReadOnlyList<LocationIqItem>> _resultsFactory;

        public FakeLocationIqClient()
            : this(_ => DefaultResult) { }

        public FakeLocationIqClient(Func<string, IReadOnlyList<LocationIqItem>> resultsFactory)
        {
            _resultsFactory = resultsFactory;
        }

        public string? LastQuery { get; private set; }

        public Task<IReadOnlyList<LocationIqItem>> ForwardGeocodeAsync(
            string query,
            int limit,
            string? countrycodes,
            string? lang,
            CancellationToken ct = default)
        {
            LastQuery = query;
            return Task.FromResult(_resultsFactory(query));
        }

        public Task<LocationIqItem?> ReverseGeocodeAsync(
            double latitude,
            double longitude,
            string? lang,
            CancellationToken ct = default)
        {
            return Task.FromResult<LocationIqItem?>(null);
        }

        private static IReadOnlyList<LocationIqItem> DefaultResult => new[]
        {
            new LocationIqItem
            {
                DisplayName = "Oslo, Norway",
                Lat = "47.5",
                Lon = "19.05",
                Address = new LocationIqAddress
                {
                    City = "Oslo",
                    Country = "Norway",
                    CountryCode = "no"
                },
                PlaceId = "123456"
            }
        };
    }
}
