using Domain.Models;

namespace Domain.Services;

public interface IAmadeusScrapingService
{
    Task<AmadeusFlightOfferResponse> GetFlightOffersAsync(
        AmadeusFlightSearchRequest request,
        CancellationToken cancellationToken);

    Task<AmadeusHotelOfferResponse> GetHotelOffersAsync(
        AmadeusHotelSearchRequest request,
        CancellationToken cancellationToken);
}
