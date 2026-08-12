#include <algorithm>
#include <vector>

int solution(std::vector<int> array, int n) {
    return static_cast<int>(std::count(array.begin(), array.end(), n));
}
