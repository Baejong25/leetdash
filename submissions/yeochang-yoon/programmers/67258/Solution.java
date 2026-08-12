import java.util.*;

class Solution {
    public int[] solution(String[] gems) {

        Set<String> set = new HashSet<>();

        for (String gem : gems) {
            set.add(gem);
        }

        int kinds = set.size();

        Map<String, Integer> map = new HashMap<>();

        int start = 0;

        int bestStart = 0;
        int bestEnd = gems.length - 1;

        for (int end = 0; end < gems.length; end++) {

            // 오른쪽 보석을 현재 구간에 추가
            map.put(
                    gems[end],
                    map.getOrDefault(gems[end], 0) + 1
            );

            // 현재 구간이 모든 종류를 포함한다면
            // 가능한 만큼 왼쪽을 줄여본다.
            while (map.size() == kinds) {

                // 현재 구간도 정답 후보
                if (end - start < bestEnd - bestStart) {
                    bestStart = start;
                    bestEnd = end;
                }

                // 왼쪽 보석 제거
                String gem = gems[start];

                map.put(gem, map.get(gem) - 1);

                if (map.get(gem) == 0) {
                    map.remove(gem);
                }

                start++;
            }
        }

        return new int[] {
                bestStart + 1,
                bestEnd + 1
        };
    }
}