import java.util.*;

class Solution {
    public int solution(int[] people, int limit) {

        Arrays.sort(people);

        int count = 0;

        int last = people.length-1;
        int first = 0;

        while(first <= last){
            if(limit >= people[last] + people[first]){
                last--;
                first++;
            }else{
                last--;
            }
            count++;
        }
        int answer = 0;
        return count;
    }
}