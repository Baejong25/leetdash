/*
[조건 정리]
- 구명보트 최대 2명 탑승 가능, 무게 제한 limit
- 모든 사람 구출하기 위해 필요한 구명보트 수 최솟값 return
- limit은 항상 사람들의 몸무게 max보다 크게 주어짐

[알고리즘 구상]
투 포인터
1. 사람 몸무게 정렬
2. 큰 사람 몸무게가 가장 작은 사람 몸무게랑 합쳤을 때 limit보다 작거나 같은지
- 작거나 같다면 가장 가벼운 사람 한명 더 포함
- 아니라면 가장 무거운 사람 전 사람으로 이동하고 보트 개수 증가하기
3. 보트 개수 return
*/
import java.util.*;

class Solution {
    public int solution(int[] people, int limit) {
        int cnt = 0;
        Arrays.sort(people);
        int left = 0;
        int right = people.length-1;
        
        while(left <= right) {
            if(people[left] + people[right] <= limit) left++;
           
                right--;
                cnt++;
       
        }
        return cnt;
    }
}